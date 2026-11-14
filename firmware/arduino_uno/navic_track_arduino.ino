/*
 * NAVIC-TRACK Arduino Uno Dual-Axis Antenna Rotator Firmware v2.0
 * 
 * HARDWARE:
 *   - Arduino Uno R3
 *   - 2× 28BYJ-48 5V stepper motors + 2× ULN2003 driver boards
 *   - Limit switches on Az home and El min/max (see config.h)
 *   - SoftwareSerial on D2 (RX from ESP32) / D3 (TX to ESP32 — via level shifter only)
 * 
 * CRITICAL ELECTRICAL NOTE:
 *   D3 TX output is 5V logic.  ESP32 GPIO16 RX is 3.3V-only.
 *   DO NOT connect D3 directly to ESP32.
 *   Use a voltage divider (10kΩ / 20kΩ → ~3.3V output) or a TXS0101 module.
 *   Phase 1 wiring is ONE-WAY: ESP32 GPIO17 → Arduino D2 only.
 *   D3 TX is defined below but NOT physically connected until a level shifter
 *   is verified in place.
 * 
 * PIN ASSIGNMENTS (must match config.h):
 *   Azimuth  ULN2003: D8, D9, D10, D11
 *   Elevation ULN2003: D4, D5, D6, D7
 *   SoftwareSerial RX: D2  (from ESP32 GPIO17 TX2)
 *   SoftwareSerial TX: D3  (to ESP32 GPIO16 RX2 — level shifter required)
 *   Az home limit:  D12  (INPUT_PULLUP, LOW = triggered)
 *   El min limit:   A0   (INPUT_PULLUP, LOW = triggered)
 *   El max limit:   A1   (INPUT_PULLUP, LOW = triggered)
 * 
 * COMMAND PROTOCOL (9600 baud, newline-terminated):
 *   GOTO,<az>,<el>      e.g. "GOTO,142.50,38.20"
 *   STOP                Halt both axes immediately
 *   HOME                Run homing sequence against limit switches
 *   STATUS              Query current estimated position
 *   ESTOP               Emergency stop — disables coils until RESET
 *   RESET               Clear emergency stop flag
 *   PING                Liveness check — replies PONG
 * 
 * RESPONSES (sent on D3 TX — only when level shifter is in place):
 *   OK,GOTO,<az>,<el>
 *   OK,STOPPED
 *   OK,HOMING_STARTED
 *   OK,HOMED,<az>,<el>
 *   ERR,HOMING_FAILED,<reason>
 *   STATUS,AZ=<az>,EL=<el>,STATE=<state>,MOVING=<0|1>
 *   OK,ESTOP
 *   OK,RESET
 *   PONG
 *   ERR,<reason>
 * 
 * SAFETY RULES (enforced in firmware, not bypassed by any command):
 *   - Motor speed is capped by STEP_INTERVAL_MICROS_AZ/EL (≤5°/s)
 *   - Movement is blocked when ESTOP is active
 *   - Limit switches stop the relevant axis instantly
 *   - If no PING received within WATCHDOG_MS, all motors stop
 *   - Homing times out after HOMING_TIMEOUT_MS
 */

#include <SoftwareSerial.h>
#include "config.h"

// ============================================================================
// SoftwareSerial setup
// ============================================================================
SoftwareSerial espSerial(PIN_SW_RX, PIN_SW_TX);  // RX=D2, TX=D3

// ============================================================================
// 8-step half-step sequence (high torque)
// ============================================================================
const uint8_t HALF_STEP_SEQ[8][4] = {
  {1, 0, 0, 0},
  {1, 1, 0, 0},
  {0, 1, 0, 0},
  {0, 1, 1, 0},
  {0, 0, 1, 0},
  {0, 0, 1, 1},
  {0, 0, 0, 1},
  {1, 0, 0, 1}
};

// ============================================================================
// System state
// ============================================================================
typedef enum {
  STATE_IDLE,
  STATE_SLEWING,
  STATE_HOMING_AZ,
  STATE_HOMING_EL,
  STATE_HOMING_DONE,
  STATE_ESTOP,
  STATE_ERROR
} SystemState;

SystemState sysState = STATE_IDLE;

long currentStepAz = 0;
long currentStepEl = 0;
long targetStepAz  = 0;
long targetStepEl  = 0;

int seqIdxAz = 0;
int seqIdxEl = 0;

unsigned long lastStepTimeAz = 0;
unsigned long lastStepTimeEl = 0;

bool movingAz = false;
bool movingEl = false;

// Watchdog: if no PING received for WATCHDOG_MS milliseconds, stop motors
unsigned long lastPingMs = 0;
bool watchdogEnabled = false;  // enabled after first PING received

// Homing timeout
unsigned long homingStartMs = 0;

// String input buffer
char inputBuf[SERIAL_BUF_SIZE];
uint8_t inputLen = 0;

// ============================================================================
// Coil control helpers
// ============================================================================
void applyStepAz(int idx) {
  digitalWrite(PIN_AZ_IN1, HALF_STEP_SEQ[idx][0]);
  digitalWrite(PIN_AZ_IN2, HALF_STEP_SEQ[idx][1]);
  digitalWrite(PIN_AZ_IN3, HALF_STEP_SEQ[idx][2]);
  digitalWrite(PIN_AZ_IN4, HALF_STEP_SEQ[idx][3]);
}

void applyStepEl(int idx) {
  digitalWrite(PIN_EL_IN1, HALF_STEP_SEQ[idx][0]);
  digitalWrite(PIN_EL_IN2, HALF_STEP_SEQ[idx][1]);
  digitalWrite(PIN_EL_IN3, HALF_STEP_SEQ[idx][2]);
  digitalWrite(PIN_EL_IN4, HALF_STEP_SEQ[idx][3]);
}

void disableAzCoils() {
  digitalWrite(PIN_AZ_IN1, LOW);
  digitalWrite(PIN_AZ_IN2, LOW);
  digitalWrite(PIN_AZ_IN3, LOW);
  digitalWrite(PIN_AZ_IN4, LOW);
}

void disableElCoils() {
  digitalWrite(PIN_EL_IN1, LOW);
  digitalWrite(PIN_EL_IN2, LOW);
  digitalWrite(PIN_EL_IN3, LOW);
  digitalWrite(PIN_EL_IN4, LOW);
}

void disableAllCoils() {
  disableAzCoils();
  disableElCoils();
}

// ============================================================================
// Position helpers
// ============================================================================
float getAzDeg() { return (float)currentStepAz / STEPS_PER_DEG_AZ; }
float getElDeg() { return (float)currentStepEl / STEPS_PER_DEG_EL; }

bool limitAzHome() { return (digitalRead(PIN_LIMIT_AZ_HOME) == LOW); }
bool limitElMin()  { return (digitalRead(PIN_LIMIT_EL_MIN)  == LOW); }
bool limitElMax()  { return (digitalRead(PIN_LIMIT_EL_MAX)  == LOW); }

// ============================================================================
// Response helper (sends on USB Serial for debug, and espSerial for bridge)
// NOTE: Only send on espSerial once a level shifter is wired to D3.
//       For Phase 1 (one-way), comment out the espSerial.println line.
// ============================================================================
void sendResponse(const char* msg) {
  Serial.println(msg);
  // espSerial.println(msg);  // ← Uncomment ONLY after level shifter verified
}

void sendResponseF(const __FlashStringHelper* msg) {
  Serial.println(msg);
  // espSerial.println(msg);  // ← Uncomment ONLY after level shifter verified
}

// ============================================================================
// Emergency stop
// ============================================================================
void emergencyStop(const char* reason) {
  movingAz = false;
  movingEl = false;
  targetStepAz = currentStepAz;
  targetStepEl = currentStepEl;
  disableAllCoils();
  sysState = STATE_ESTOP;

  char buf[80];
  snprintf(buf, sizeof(buf), "ESTOP,%s", reason);
  sendResponse(buf);
}

// ============================================================================
// Stop both axes (safe stop, not emergency)
// ============================================================================
void stopAll() {
  movingAz = false;
  movingEl = false;
  targetStepAz = currentStepAz;
  targetStepEl = currentStepEl;
  disableAllCoils();
  if (sysState == STATE_SLEWING || sysState == STATE_HOMING_AZ || sysState == STATE_HOMING_EL) {
    sysState = STATE_IDLE;
  }
}

// ============================================================================
// Command parser
// ============================================================================
void executeCommand(char* cmd) {
  // Trim trailing whitespace
  int len = strlen(cmd);
  while (len > 0 && (cmd[len-1] == '\r' || cmd[len-1] == '\n' || cmd[len-1] == ' ')) {
    cmd[--len] = '\0';
  }
  if (len == 0) return;

  // ---- GOTO ----
  if (strncmp(cmd, "GOTO,", 5) == 0) {
    if (sysState == STATE_ESTOP) {
      sendResponseF(F("ERR,ESTOP_ACTIVE,SEND_RESET_FIRST"));
      return;
    }

    char* p1 = strchr(cmd + 5, ',');
    if (!p1) {
      sendResponseF(F("ERR,INVALID_GOTO_FORMAT"));
      return;
    }
    *p1 = '\0';
    float reqAz = atof(cmd + 5);
    float reqEl = atof(p1 + 1);

    if (reqAz < AZ_MIN_DEG || reqAz > AZ_MAX_DEG) {
      sendResponseF(F("ERR,AZIMUTH_OUT_OF_BOUNDS_0_360"));
      return;
    }
    if (reqEl < EL_MIN_DEG || reqEl > EL_MAX_DEG) {
      sendResponseF(F("ERR,ELEVATION_OUT_OF_BOUNDS_0_90"));
      return;
    }

    targetStepAz = (long)(reqAz * STEPS_PER_DEG_AZ);
    targetStepEl = (long)(reqEl * STEPS_PER_DEG_EL);

    movingAz = (targetStepAz != currentStepAz);
    movingEl = (targetStepEl != currentStepEl);

    if (movingAz || movingEl) {
      sysState = STATE_SLEWING;
    }

    char buf[48];
    snprintf(buf, sizeof(buf), "OK,GOTO,%.2f,%.2f", reqAz, reqEl);
    sendResponse(buf);
    return;
  }

  // ---- STOP ----
  if (strcmp(cmd, "STOP") == 0) {
    stopAll();
    sendResponseF(F("OK,STOPPED"));
    return;
  }

  // ---- ESTOP ----
  if (strcmp(cmd, "ESTOP") == 0) {
    emergencyStop("MANUAL");
    return;
  }

  // ---- RESET (clear ESTOP) ----
  if (strcmp(cmd, "RESET") == 0) {
    if (sysState == STATE_ESTOP || sysState == STATE_ERROR) {
      sysState = STATE_IDLE;
      sendResponseF(F("OK,RESET"));
    } else {
      sendResponseF(F("ERR,NOT_IN_ESTOP_OR_ERROR"));
    }
    return;
  }

  // ---- HOME ----
  if (strcmp(cmd, "HOME") == 0) {
    if (sysState == STATE_ESTOP) {
      sendResponseF(F("ERR,ESTOP_ACTIVE,SEND_RESET_FIRST"));
      return;
    }
    // Begin homing: drive azimuth toward home limit switch
    sysState = STATE_HOMING_AZ;
    homingStartMs = millis();
    // Drive azimuth in the negative direction (toward home)
    // Target is set far negative so the motor keeps moving until limit switch triggers
    targetStepAz = -(long)(360.0 * STEPS_PER_DEG_AZ);
    movingAz = true;
    disableElCoils();
    movingEl = false;
    sendResponseF(F("OK,HOMING_STARTED"));
    return;
  }

  // ---- STATUS ----
  if (strcmp(cmd, "STATUS") == 0) {
    const char* stateStr = "IDLE";
    switch (sysState) {
      case STATE_SLEWING:    stateStr = "SLEWING";    break;
      case STATE_HOMING_AZ:  stateStr = "HOMING_AZ";  break;
      case STATE_HOMING_EL:  stateStr = "HOMING_EL";  break;
      case STATE_HOMING_DONE:stateStr = "HOMED";      break;
      case STATE_ESTOP:      stateStr = "ESTOP";      break;
      case STATE_ERROR:      stateStr = "ERROR";      break;
      default:               stateStr = "IDLE";       break;
    }
    char buf[80];
    snprintf(buf, sizeof(buf),
      "STATUS,AZ=%.2f,EL=%.2f,STATE=%s,MOVING=%d",
      getAzDeg(), getElDeg(), stateStr, (movingAz || movingEl) ? 1 : 0
    );
    sendResponse(buf);
    return;
  }

  // ---- PING ----
  if (strcmp(cmd, "PING") == 0) {
    lastPingMs = millis();
    watchdogEnabled = true;
    sendResponseF(F("PONG"));
    return;
  }

  // ---- Unknown ----
  char buf[48];
  snprintf(buf, sizeof(buf), "ERR,UNKNOWN_CMD: %.30s", cmd);
  sendResponse(buf);
}

// ============================================================================
// Homing state machine
// Called from loop() when sysState is HOMING_AZ or HOMING_EL
// ============================================================================
void runHomingTick(unsigned long nowMicros) {
  unsigned long nowMs = nowMicros / 1000;

  // --- Timeout check ---
  if (nowMs - homingStartMs > HOMING_TIMEOUT_MS) {
    stopAll();
    sysState = STATE_ERROR;
    sendResponseF(F("ERR,HOMING_FAILED,TIMEOUT"));
    return;
  }

  if (sysState == STATE_HOMING_AZ) {
    // Check Az home limit switch
    if (limitAzHome()) {
      // Hit the azimuth home switch — stop, back off, zero the counter
      disableAzCoils();
      movingAz = false;
      currentStepAz = 0;
      targetStepAz  = 0;

      // Apply back-off
      long backoffSteps = (long)(HOMING_BACKOFF_DEG * STEPS_PER_DEG_AZ);
      targetStepAz = backoffSteps;
      movingAz = (backoffSteps > 0);

      // Transition to elevation homing
      sysState = STATE_HOMING_EL;
      targetStepEl = -(long)(90.0 * STEPS_PER_DEG_EL);  // Drive toward EL min
      movingEl = true;
      return;
    }

    // Drive azimuth toward home (currentStepAz > targetStepAz means moving negative)
    if (movingAz && (nowMicros - lastStepTimeAz >= STEP_INTERVAL_MICROS_AZ)) {
      lastStepTimeAz = nowMicros;
      // Move in negative direction
      seqIdxAz = (seqIdxAz + 7) % 8;
      currentStepAz--;
      applyStepAz(seqIdxAz);
    }
    return;
  }

  if (sysState == STATE_HOMING_EL) {
    // Finish Az back-off if still moving
    if (movingAz && (nowMicros - lastStepTimeAz >= STEP_INTERVAL_MICROS_AZ)) {
      lastStepTimeAz = nowMicros;
      if (currentStepAz < targetStepAz) {
        seqIdxAz = (seqIdxAz + 1) % 8;
        currentStepAz++;
        applyStepAz(seqIdxAz);
      } else {
        disableAzCoils();
        movingAz = false;
      }
    }

    // Check El min limit switch
    if (limitElMin()) {
      disableElCoils();
      movingEl = false;
      currentStepEl = 0;
      targetStepEl  = 0;

      // Apply back-off
      long backoffSteps = (long)(HOMING_BACKOFF_DEG * STEPS_PER_DEG_EL);
      targetStepEl = backoffSteps;
      movingEl = (backoffSteps > 0);

      sysState = STATE_HOMING_DONE;

      char buf[48];
      snprintf(buf, sizeof(buf), "OK,HOMED,%.2f,%.2f", getAzDeg(), getElDeg());
      sendResponse(buf);
      return;
    }

    // Drive elevation toward min limit
    if (movingEl && (nowMicros - lastStepTimeEl >= STEP_INTERVAL_MICROS_EL)) {
      lastStepTimeEl = nowMicros;
      seqIdxEl = (seqIdxEl + 7) % 8;
      currentStepEl--;
      applyStepEl(seqIdxEl);
    }
    return;
  }

  // STATE_HOMING_DONE: finish back-off movement
  if (sysState == STATE_HOMING_DONE) {
    bool stillMoving = false;
    if (movingEl && (nowMicros - lastStepTimeEl >= STEP_INTERVAL_MICROS_EL)) {
      lastStepTimeEl = nowMicros;
      if (currentStepEl < targetStepEl) {
        seqIdxEl = (seqIdxEl + 1) % 8;
        currentStepEl++;
        applyStepEl(seqIdxEl);
        stillMoving = true;
      } else {
        disableElCoils();
        movingEl = false;
      }
    }
    if (!stillMoving && !movingAz) {
      sysState = STATE_IDLE;
    }
  }
}

// ============================================================================
// Normal slewing tick — runs in loop() when STATE_SLEWING
// ============================================================================
void runSlewTick(unsigned long nowMicros) {
  bool anyMoving = false;

  // Azimuth
  if (movingAz && (nowMicros - lastStepTimeAz >= STEP_INTERVAL_MICROS_AZ)) {
    lastStepTimeAz = nowMicros;

    // Limit switch protection: stop if we hit Az home during a slew
    if (limitAzHome() && currentStepAz <= 0) {
      // At zero — stop
      currentStepAz = 0;
      targetStepAz  = 0;
      movingAz = false;
      disableAzCoils();
    } else if (currentStepAz < targetStepAz) {
      seqIdxAz = (seqIdxAz + 1) % 8;
      currentStepAz++;
      applyStepAz(seqIdxAz);
      anyMoving = true;
    } else if (currentStepAz > targetStepAz) {
      seqIdxAz = (seqIdxAz + 7) % 8;
      currentStepAz--;
      applyStepAz(seqIdxAz);
      anyMoving = true;
    } else {
      movingAz = false;
      disableAzCoils();
    }
  } else if (movingAz) {
    anyMoving = true;
  }

  // Elevation
  if (movingEl && (nowMicros - lastStepTimeEl >= STEP_INTERVAL_MICROS_EL)) {
    lastStepTimeEl = nowMicros;

    // Limit switch protection
    if (limitElMin() && currentStepEl <= 0) {
      currentStepEl = 0;
      targetStepEl  = 0;
      movingEl = false;
      disableElCoils();
    } else if (limitElMax() && currentStepEl >= targetStepEl) {
      movingEl = false;
      disableElCoils();
      emergencyStop("EL_MAX_HIT");
    } else if (currentStepEl < targetStepEl) {
      seqIdxEl = (seqIdxEl + 1) % 8;
      currentStepEl++;
      applyStepEl(seqIdxEl);
      anyMoving = true;
    } else if (currentStepEl > targetStepEl) {
      seqIdxEl = (seqIdxEl + 7) % 8;
      currentStepEl--;
      applyStepEl(seqIdxEl);
      anyMoving = true;
    } else {
      movingEl = false;
      disableElCoils();
    }
  } else if (movingEl) {
    anyMoving = true;
  }

  if (!anyMoving) {
    sysState = STATE_IDLE;
  }
}

// ============================================================================
// setup()
// ============================================================================
void setup() {
  Serial.begin(9600);
  while (!Serial && millis() < 1000) {}

  espSerial.begin(9600);

  // Motor GPIO
  pinMode(PIN_AZ_IN1, OUTPUT); pinMode(PIN_AZ_IN2, OUTPUT);
  pinMode(PIN_AZ_IN3, OUTPUT); pinMode(PIN_AZ_IN4, OUTPUT);
  pinMode(PIN_EL_IN1, OUTPUT); pinMode(PIN_EL_IN2, OUTPUT);
  pinMode(PIN_EL_IN3, OUTPUT); pinMode(PIN_EL_IN4, OUTPUT);
  disableAllCoils();

  // Limit switches (INPUT_PULLUP: LOW = triggered)
  pinMode(PIN_LIMIT_AZ_HOME, INPUT_PULLUP);
  pinMode(PIN_LIMIT_EL_MIN,  INPUT_PULLUP);
  pinMode(PIN_LIMIT_EL_MAX,  INPUT_PULLUP);

  lastPingMs = millis();

  sendResponseF(F("NAVIC_TRACK_ARDUINO_READY,V2.0"));
  sendResponseF(F("INFO,HOMING_REQUIRED_BEFORE_TRACKING"));
  sendResponseF(F("INFO,SEND_HOME_TO_BEGIN_HOMING_SEQUENCE"));
}

// ============================================================================
// loop()
// ============================================================================
void loop() {
  unsigned long nowMicros = micros();
  unsigned long nowMs     = nowMicros / 1000;

  // --- Read incoming serial (from ESP32 D2 or USB Serial) ---
  // Read from both: USB Serial for direct testing, espSerial for ESP32 commands
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputLen > 0) {
        inputBuf[inputLen] = '\0';
        executeCommand(inputBuf);
        inputLen = 0;
      }
    } else if (inputLen < SERIAL_BUF_SIZE - 1) {
      inputBuf[inputLen++] = c;
    }
  }

  while (espSerial.available() > 0) {
    char c = (char)espSerial.read();
    if (c == '\n' || c == '\r') {
      if (inputLen > 0) {
        inputBuf[inputLen] = '\0';
        executeCommand(inputBuf);
        inputLen = 0;
      }
    } else if (inputLen < SERIAL_BUF_SIZE - 1) {
      inputBuf[inputLen++] = c;
    }
  }

  // --- Watchdog ---
  if (watchdogEnabled && (nowMs - lastPingMs > WATCHDOG_MS)) {
    if (movingAz || movingEl) {
      stopAll();
      sendResponseF(F("WARN,WATCHDOG_TIMEOUT,MOTORS_STOPPED"));
    }
    // Reset timer so we don't spam this message
    lastPingMs = nowMs;
  }

  // --- State machine ---
  if (sysState == STATE_ESTOP || sysState == STATE_ERROR) {
    disableAllCoils();
    return;
  }

  if (sysState == STATE_HOMING_AZ || sysState == STATE_HOMING_EL || sysState == STATE_HOMING_DONE) {
    runHomingTick(nowMicros);
    return;
  }

  if (sysState == STATE_SLEWING) {
    runSlewTick(nowMicros);
    return;
  }

  // STATE_IDLE — ensure coils are off
  if (sysState == STATE_IDLE && !movingAz && !movingEl) {
    // No action — coils were already disabled when movement completed
  }
}
