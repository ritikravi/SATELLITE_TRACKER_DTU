/*
 * NAVIC-TRACK Arduino Uno Dual-Axis Antenna Rotator Firmware
 * 
 * Hardware:
 *   - Arduino Uno R3
 *   - 2x 28BYJ-48 5V Stepper Motors (Internal ~1:63.684 gearbox)
 *   - 2x ULN2003 Darlington Driver Boards
 *   - External 5V 2A Power Supply for steppers (Common GND with Arduino)
 * 
 * Pin Configuration (PRESERVED AS SPECIFIED):
 *   - Azimuth ULN2003:   IN1 -> D8, IN2 -> D9, IN3 -> D10, IN4 -> D11
 *   - Elevation ULN2003: IN1 -> D4, IN2 -> D5, IN3 -> D6,  IN4 -> D7
 * 
 * Serial Command Protocol (115200 Baud, newline terminated):
 *   - GOTO,<azimuth>,<elevation>  e.g. "GOTO,142.50,38.20"
 *   - STOP                        Immediately halt motor motion
 *   - HOME                        Re-zero coordinate position
 *   - STATUS                      Query current position and status
 * 
 * Responses:
 *   - OK,GOTO,<az>,<el>
 *   - OK,STOP
 *   - OK,HOME
 *   - STATUS,<az>,<el>,<state>
 *   - ERR,<reason>
 */

#include <Arduino.h>

// --- PIN ASSIGNMENTS ---
const int PIN_AZ_IN1 = 8;
const int PIN_AZ_IN2 = 9;
const int PIN_AZ_IN3 = 10;
const int PIN_AZ_IN4 = 11;

const int PIN_EL_IN1 = 4;
const int PIN_EL_IN2 = 5;
const int PIN_EL_IN3 = 6;
const int PIN_EL_IN4 = 7;

// --- STEPPER 8-STEP HALF-STEPPING SEQUENCE ---
// High-torque, smooth 8-phase half-step excitation
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

// --- MECHANICAL CALIBRATION ---
// 28BYJ-48 has ~4075.77 half-steps per output shaft revolution.
// Elevation: 14T pinion to 50T gear = 3.5714:1 reduction.
// Steps per degree = 4075.77 * (50.0 / 14.0) / 360.0 ~= 40.43 half-steps/deg.
// Azimuth: pinion to ring gear ratio ~= 3.55:1 = ~40.25 half-steps/deg.
const float STEPS_PER_DEG_AZ = 40.25;
const float STEPS_PER_DEG_EL = 40.43;

// --- PHYSICAL SAFETY LIMITS ---
const float MIN_AZ = 0.0;
const float MAX_AZ = 360.0;
const float MIN_EL = 0.0;
const float MAX_EL = 90.0;

// --- STEP TIMING ---
// Minimum microseconds between half-steps (slow, steady slewing < 5 deg/s to prevent stall)
const unsigned long STEP_INTERVAL_MICROS = 2200; // ~450 steps/sec ~= 3.5 deg/s

// --- SYSTEM STATE ---
long currentStepAz = 0;
long currentStepEl = 0;
long targetStepAz = 0;
long targetStepEl = 0;

int seqIndexAz = 0;
int seqIndexEl = 0;

unsigned long lastStepTimeAz = 0;
unsigned long lastStepTimeEl = 0;

bool isMovingAz = false;
bool isMovingEl = false;

String inputBuffer = "";

// Disable stepper coils to prevent ULN2003 heat buildup when idle
void disableAzimuthCoils() {
  digitalWrite(PIN_AZ_IN1, LOW);
  digitalWrite(PIN_AZ_IN2, LOW);
  digitalWrite(PIN_AZ_IN3, LOW);
  digitalWrite(PIN_AZ_IN4, LOW);
}

void disableElevationCoils() {
  digitalWrite(PIN_EL_IN1, LOW);
  digitalWrite(PIN_EL_IN2, LOW);
  digitalWrite(PIN_EL_IN3, LOW);
  digitalWrite(PIN_EL_IN4, LOW);
}

void applyStepAz(int seqIdx) {
  digitalWrite(PIN_AZ_IN1, HALF_STEP_SEQ[seqIdx][0]);
  digitalWrite(PIN_AZ_IN2, HALF_STEP_SEQ[seqIdx][1]);
  digitalWrite(PIN_AZ_IN3, HALF_STEP_SEQ[seqIdx][2]);
  digitalWrite(PIN_AZ_IN4, HALF_STEP_SEQ[seqIdx][3]);
}

void applyStepEl(int seqIdx) {
  digitalWrite(PIN_EL_IN1, HALF_STEP_SEQ[seqIdx][0]);
  digitalWrite(PIN_EL_IN2, HALF_STEP_SEQ[seqIdx][1]);
  digitalWrite(PIN_EL_IN3, HALF_STEP_SEQ[seqIdx][2]);
  digitalWrite(PIN_EL_IN4, HALF_STEP_SEQ[seqIdx][3]);
}

float getCurrentAzimuthDeg() {
  return (float)currentStepAz / STEPS_PER_DEG_AZ;
}

float getCurrentElevationDeg() {
  return (float)currentStepEl / STEPS_PER_DEG_EL;
}

void executeCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd.startsWith("GOTO,")) {
    // Expected format: GOTO,<az>,<el>
    int firstComma = cmd.indexOf(',');
    int secondComma = cmd.indexOf(',', firstComma + 1);

    if (firstComma == -1 || secondComma == -1) {
      Serial.println(F("ERR,INVALID_GOTO_SYNTAX"));
      return;
    }

    float reqAz = cmd.substring(firstComma + 1, secondComma).toFloat();
    float reqEl = cmd.substring(secondComma + 1).toFloat();

    // Validate mechanical bounds
    if (reqAz < MIN_AZ || reqAz > MAX_AZ) {
      Serial.println(F("ERR,AZIMUTH_OUT_OF_BOUNDS_0_360"));
      return;
    }
    if (reqEl < MIN_EL || reqEl > MAX_EL) {
      Serial.println(F("ERR,ELEVATION_OUT_OF_BOUNDS_0_90"));
      return;
    }

    targetStepAz = (long)(reqAz * STEPS_PER_DEG_AZ);
    targetStepEl = (long)(reqEl * STEPS_PER_DEG_EL);

    isMovingAz = (targetStepAz != currentStepAz);
    isMovingEl = (targetStepEl != currentStepEl);

    Serial.print(F("OK,GOTO,"));
    Serial.print(reqAz, 2);
    Serial.print(F(","));
    Serial.println(reqEl, 2);
  }
  else if (cmd.equals("STOP")) {
    targetStepAz = currentStepAz;
    targetStepEl = currentStepEl;
    isMovingAz = false;
    isMovingEl = false;
    disableAzimuthCoils();
    disableElevationCoils();
    Serial.println(F("OK,STOPPED"));
  }
  else if (cmd.equals("HOME")) {
    // Re-center current coordinate frame to 0,0
    currentStepAz = 0;
    currentStepEl = 0;
    targetStepAz = 0;
    targetStepEl = 0;
    isMovingAz = false;
    isMovingEl = false;
    disableAzimuthCoils();
    disableElevationCoils();
    Serial.println(F("OK,HOMED_TO_ZERO"));
  }
  else if (cmd.equals("STATUS")) {
    Serial.print(F("STATUS,AZ="));
    Serial.print(getCurrentAzimuthDeg(), 2);
    Serial.print(F(",EL="));
    Serial.print(getCurrentElevationDeg(), 2);
    Serial.print(F(",MOVING="));
    Serial.println((isMovingAz || isMovingEl) ? 1 : 0);
  }
  else {
    Serial.print(F("ERR,UNKNOWN_COMMAND: "));
    Serial.println(cmd);
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 1000) {}

  // Initialize GPIO pins as OUTPUT
  pinMode(PIN_AZ_IN1, OUTPUT);
  pinMode(PIN_AZ_IN2, OUTPUT);
  pinMode(PIN_AZ_IN3, OUTPUT);
  pinMode(PIN_AZ_IN4, OUTPUT);

  pinMode(PIN_EL_IN1, OUTPUT);
  pinMode(PIN_EL_IN2, OUTPUT);
  pinMode(PIN_EL_IN3, OUTPUT);
  pinMode(PIN_EL_IN4, OUTPUT);

  // Set initial coils LOW (idle, no current drain)
  disableAzimuthCoils();
  disableElevationCoils();

  Serial.println(F("NAVIC_TRACK_ARDUINO_READY,V1.2"));
}

void loop() {
  // 1. Process Incoming Serial Commands
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputBuffer.length() > 0) {
        executeCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      if (inputBuffer.length() < 64) {
        inputBuffer += c;
      }
    }
  }

  unsigned long nowMicros = micros();

  // 2. Step Azimuth Motor
  if (isMovingAz && (nowMicros - lastStepTimeAz >= STEP_INTERVAL_MICROS)) {
    lastStepTimeAz = nowMicros;
    if (currentStepAz < targetStepAz) {
      seqIndexAz = (seqIndexAz + 1) % 8;
      currentStepAz++;
      applyStepAz(seqIndexAz);
    } else if (currentStepAz > targetStepAz) {
      seqIndexAz = (seqIndexAz + 7) % 8;
      currentStepAz--;
      applyStepAz(seqIndexAz);
    } else {
      isMovingAz = false;
      disableAzimuthCoils(); // Cool down coils when target reached
    }
  }

  // 3. Step Elevation Motor
  if (isMovingEl && (nowMicros - lastStepTimeEl >= STEP_INTERVAL_MICROS)) {
    lastStepTimeEl = nowMicros;
    if (currentStepEl < targetStepEl) {
      seqIndexEl = (seqIndexEl + 1) % 8;
      currentStepEl++;
      applyStepEl(seqIndexEl);
    } else if (currentStepEl > targetStepEl) {
      seqIndexEl = (seqIndexEl + 7) % 8;
      currentStepEl--;
      applyStepEl(seqIndexEl);
    } else {
      isMovingEl = false;
      disableElevationCoils(); // Cool down coils when target reached
    }
  }
}

