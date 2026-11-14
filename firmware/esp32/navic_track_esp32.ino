/*
 * NAVIC-TRACK ESP32 Wi-Fi Bridge Firmware v2.0
 * 
 * HARDWARE:
 *   - ESP32-WROOM-32 DevKit V1
 *   - Connected to Arduino Uno via UART2:
 *       ESP32 GPIO17 TX2 → Arduino D2 (SoftwareSerial RX)   [SAFE: 3.3V→5V AVR input]
 *       ESP32 GPIO16 RX2 ← Arduino D3 TX (LEVEL SHIFTER REQUIRED: 5V→3.3V)
 *   - Wi-Fi (STA mode with AP fallback)
 * 
 * PHASE 1 (current): ONE-WAY transmission only.
 *   ESP32 GPIO17 → Arduino D2.  GPIO16 is NOT connected.
 *   The firmware reads status from Arduino but expects no return in Phase 1.
 *   Once a verified level shifter is in place, enable bidirectional serial.
 * 
 * FUNCTION:
 *   - Connect to Wi-Fi (AP fallback if STA fails)
 *   - Expose REST API compatible with the NAVIC-TRACK API v1 spec
 *   - Forward sanitised GOTO/STOP/HOME/ESTOP commands to Arduino
 *   - Track command acknowledgement state
 *   - Report hardware_mode: "HARDWARE_CONNECTED" when Arduino responds
 * 
 * CREDENTIALS:
 *   Wi-Fi SSID/password and auth token are in esp32_config.h (not committed to git).
 *   See esp32_config.h.example for the template.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include "esp32_config.h"

// ============================================================================
// Hardware serial to Arduino (UART2)
// ============================================================================
HardwareSerial ArduinoSerial(2);
const int PIN_RX2 = 16;   // Not wired in Phase 1
const int PIN_TX2 = 17;   // Connected to Arduino D2

// ============================================================================
// Web server
// ============================================================================
WebServer server(80);

// ============================================================================
// Tracker state (maintained on ESP32, updated from Arduino responses)
// ============================================================================
typedef enum {
  HW_UNKNOWN,
  HW_CONNECTED,     // Arduino responded to PING
  HW_DISCONNECTED,  // No response within HW_PROBE_INTERVAL_MS
  HW_ERROR
} HardwareConnState;

struct TrackerState {
  float    currentAz      = 0.0;
  float    currentEl      = 0.0;
  float    targetAz       = 0.0;
  float    targetEl       = 0.0;
  bool     isTracking     = false;
  bool     isHomed        = false;
  bool     isEStop        = false;
  String   stateStr       = "IDLE";
  String   lastError      = "";
  String   firmwareVer    = "2.0-esp32";
  unsigned long uptimeSec = 0;
  unsigned long startMs   = 0;
  HardwareConnState hwConn = HW_UNKNOWN;
  unsigned long lastArduinoResponseMs = 0;
};

TrackerState tracker;

// ============================================================================
// Command acknowledgement tracking
// ============================================================================
typedef enum {
  CMD_NONE,
  CMD_SENT_GOTO,
  CMD_SENT_STOP,
  CMD_SENT_HOME,
  CMD_SENT_ESTOP,
  CMD_SENT_PING
} PendingCmdType;

struct PendingCmd {
  PendingCmdType type = CMD_NONE;
  unsigned long  sentMs = 0;
  float          targetAz = 0;
  float          targetEl = 0;
};

PendingCmd pendingCmd;
const unsigned long CMD_TIMEOUT_MS = 10000;  // 10 seconds for command ack

// ============================================================================
// Arduino serial receive buffer
// ============================================================================
#define ARDUINO_BUF_SIZE 128
char arduinoBuf[ARDUINO_BUF_SIZE];
int  arduinoBufLen = 0;

// ============================================================================
// Hardware probe
// ============================================================================
const unsigned long HW_PROBE_INTERVAL_MS  = 5000;   // Ping Arduino every 5s
const unsigned long HW_DISCONNECT_TIMEOUT = 15000;  // Mark disconnected after 15s
unsigned long lastPingMs = 0;

// ============================================================================
// Authentication
// ============================================================================
bool isAuthenticated() {
  String auth = server.header("Authorization");
  if (auth.startsWith("Bearer ")) {
    return auth.substring(7).equals(AUTH_TOKEN);
  }
  String apiKey = server.header("X-API-Key");
  if (apiKey.length() > 0 && apiKey.equals(AUTH_TOKEN)) {
    return true;
  }
  return false;
}

// ============================================================================
// Response helpers
// ============================================================================
void sendSuccess(int code, JsonDocument& data) {
  String body;
  JsonDocument env;
  env["success"]   = true;
  env["data"]      = data;
  env["timestamp"] = String(millis());   // Real time would need NTP
  serializeJson(env, body);
  server.send(code, "application/json", body);
}

void sendError(int code, const String& msg) {
  String body;
  JsonDocument env;
  env["success"]   = false;
  env["error"]     = msg;
  env["timestamp"] = String(millis());
  serializeJson(env, body);
  server.send(code, "application/json", body);
}

// ============================================================================
// Send command to Arduino
// ============================================================================
void sendToArduino(const char* cmd) {
  ArduinoSerial.println(cmd);
  Serial.print("[→Arduino] ");
  Serial.println(cmd);
}

// ============================================================================
// Hardware mode string
// ============================================================================
const char* getHardwareMode() {
  switch (tracker.hwConn) {
    case HW_CONNECTED:    return "HARDWARE_CONNECTED";
    case HW_DISCONNECTED: return "HARDWARE_DISCONNECTED";
    case HW_ERROR:        return "HARDWARE_ERROR";
    default:              return "HARDWARE_UNKNOWN";
  }
}

// ============================================================================
// REST Handlers
// ============================================================================

void handleStatus() {
  JsonDocument data;
  data["state"]             = tracker.stateStr;
  data["homed"]             = tracker.isHomed;
  data["hardwareConnected"] = (tracker.hwConn == HW_CONNECTED);
  data["hardware_mode"]     = getHardwareMode();
  data["firmwareVersion"]   = tracker.firmwareVer;
  data["uptimeSeconds"]     = tracker.uptimeSec;
  data["lastError"]         = tracker.lastError;

  JsonObject cur = data["currentAngles"].to<JsonObject>();
  cur["azimuth"]   = tracker.currentAz;
  cur["elevation"] = tracker.currentEl;

  JsonObject tgt = data["targetAngles"].to<JsonObject>();
  tgt["azimuth"]   = tracker.targetAz;
  tgt["elevation"] = tracker.targetEl;

  // IMU not implemented yet — will be populated when MPU-6050 is wired
  JsonObject imu = data["imu"].to<JsonObject>();
  imu["pitch"]   = 0.0;
  imu["roll"]    = 0.0;
  imu["isLevel"] = false;
  imu["note"]    = "MPU-6050 not yet implemented";

  sendSuccess(200, data);
}

void handleMove() {
  if (!isAuthenticated()) { sendError(401, "Unauthorized"); return; }
  if (tracker.isEStop)    { sendError(503, "Emergency stop active — send RESET first"); return; }
  if (!tracker.isHomed)   { sendError(503, "Homing required before movement"); return; }

  if (!server.hasArg("plain")) { sendError(400, "Missing request body"); return; }

  JsonDocument body;
  DeserializationError err = deserializeJson(body, server.arg("plain"));
  if (err) { sendError(400, "Invalid JSON"); return; }

  float reqAz = body["azimuth"] | -1.0f;
  float reqEl = body["elevation"] | -1.0f;

  if (reqAz < 0.0 || reqAz > 360.0) { sendError(400, "Azimuth out of range (0–360)"); return; }
  if (reqEl < 0.0 || reqEl > 90.0)  { sendError(400, "Elevation out of range (0–90)"); return; }

  tracker.targetAz = reqAz;
  tracker.targetEl = reqEl;
  tracker.stateStr = "SLEWING";

  char cmd[48];
  snprintf(cmd, sizeof(cmd), "GOTO,%.2f,%.2f", reqAz, reqEl);
  sendToArduino(cmd);

  pendingCmd = { CMD_SENT_GOTO, millis(), reqAz, reqEl };

  JsonDocument resp;
  resp["state"]     = "SLEWING";
  resp["targetAz"]  = reqAz;
  resp["targetEl"]  = reqEl;
  resp["note"]      = "Command sent to Arduino. Acknowledgement pending.";
  sendSuccess(200, resp);
}

void handleStop() {
  if (!isAuthenticated()) { sendError(401, "Unauthorized"); return; }
  tracker.isTracking = false;
  tracker.stateStr   = "IDLE";
  sendToArduino("STOP");
  pendingCmd = { CMD_SENT_STOP, millis(), 0, 0 };

  JsonDocument resp;
  resp["state"] = "IDLE";
  sendSuccess(200, resp);
}

void handleEStop() {
  if (!isAuthenticated()) { sendError(401, "Unauthorized"); return; }
  tracker.isTracking = false;
  tracker.isEStop    = true;
  tracker.stateStr   = "EMERGENCY_STOP";
  sendToArduino("ESTOP");
  pendingCmd = { CMD_SENT_ESTOP, millis(), 0, 0 };

  JsonDocument resp;
  resp["state"] = "EMERGENCY_STOP";
  resp["note"]  = "Emergency stop sent to Arduino.";
  sendSuccess(200, resp);
}

void handleEStopReset() {
  if (!isAuthenticated()) { sendError(401, "Unauthorized"); return; }
  tracker.isEStop  = false;
  tracker.stateStr = "IDLE";
  sendToArduino("RESET");

  JsonDocument resp;
  resp["state"] = "IDLE";
  resp["note"]  = "ESTOP cleared.";
  sendSuccess(200, resp);
}

void handleHome() {
  if (!isAuthenticated()) { sendError(401, "Unauthorized"); return; }
  if (tracker.isEStop) { sendError(503, "Emergency stop active"); return; }
  tracker.isHomed  = false;
  tracker.stateStr = "HOMING";
  tracker.targetAz = 0.0;
  tracker.targetEl = 0.0;
  sendToArduino("HOME");
  pendingCmd = { CMD_SENT_HOME, millis(), 0, 0 };

  JsonDocument resp;
  resp["state"]   = "HOMING";
  resp["message"] = "Homing sequence initiated. Mount will drive to limit switches.";
  sendSuccess(200, resp);
}

void handleTrack() {
  if (!isAuthenticated()) { sendError(401, "Unauthorized"); return; }
  if (tracker.isEStop)    { sendError(503, "Emergency stop active"); return; }
  if (!tracker.isHomed)   { sendError(503, "Homing required before tracking"); return; }

  if (!server.hasArg("plain")) { sendError(400, "Missing body"); return; }

  JsonDocument body;
  deserializeJson(body, server.arg("plain"));
  String action = body["action"] | "STOP";

  if (action == "START") {
    tracker.isTracking = true;
    tracker.stateStr   = "TRACKING";
  } else {
    tracker.isTracking = false;
    tracker.stateStr   = "IDLE";
    sendToArduino("STOP");
  }

  JsonDocument resp;
  resp["state"] = tracker.stateStr;
  sendSuccess(200, resp);
}

// ============================================================================
// Parse Arduino response lines
// ============================================================================
void processArduinoLine(const char* line) {
  Serial.print("[←Arduino] ");
  Serial.println(line);

  tracker.lastArduinoResponseMs = millis();
  tracker.hwConn = HW_CONNECTED;

  if (strcmp(line, "PONG") == 0) {
    if (pendingCmd.type == CMD_SENT_PING) pendingCmd.type = CMD_NONE;
    return;
  }

  if (strncmp(line, "OK,GOTO", 7) == 0) {
    if (pendingCmd.type == CMD_SENT_GOTO) pendingCmd.type = CMD_NONE;
    tracker.stateStr = "SLEWING";
    return;
  }

  if (strcmp(line, "OK,STOPPED") == 0) {
    if (pendingCmd.type == CMD_SENT_STOP) pendingCmd.type = CMD_NONE;
    tracker.stateStr = "IDLE";
    tracker.currentAz = tracker.targetAz;
    tracker.currentEl = tracker.targetEl;
    return;
  }

  if (strcmp(line, "OK,HOMING_STARTED") == 0) {
    tracker.stateStr = "HOMING";
    return;
  }

  if (strncmp(line, "OK,HOMED", 8) == 0) {
    if (pendingCmd.type == CMD_SENT_HOME) pendingCmd.type = CMD_NONE;
    tracker.isHomed  = true;
    tracker.currentAz = 0.0;
    tracker.currentEl = 0.0;
    tracker.targetAz  = 0.0;
    tracker.targetEl  = 0.0;
    tracker.stateStr  = "IDLE";
    Serial.println("[ESP32] Arduino homed successfully.");
    return;
  }

  if (strncmp(line, "ERR,HOMING_FAILED", 17) == 0) {
    if (pendingCmd.type == CMD_SENT_HOME) pendingCmd.type = CMD_NONE;
    tracker.stateStr = "ERROR";
    tracker.lastError = String(line);
    return;
  }

  if (strncmp(line, "STATUS,", 7) == 0) {
    // Parse: STATUS,AZ=<f>,EL=<f>,STATE=<s>,MOVING=<0|1>
    float az = 0, el = 0;
    sscanf(line + 7, "AZ=%f,EL=%f", &az, &el);
    tracker.currentAz = az;
    tracker.currentEl = el;
    return;
  }

  if (strncmp(line, "ESTOP,", 6) == 0) {
    tracker.isEStop  = true;
    tracker.stateStr = "EMERGENCY_STOP";
    tracker.lastError = String(line);
    return;
  }

  if (strncmp(line, "ERR,", 4) == 0) {
    tracker.stateStr  = "ERROR";
    tracker.lastError = String(line);
    return;
  }
}

// ============================================================================
// setup()
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[ESP32] NAVIC-TRACK Bridge v2.0 starting...");

  // UART2 at 9600 baud to match Arduino SoftwareSerial
  ArduinoSerial.begin(9600, SERIAL_8N1, PIN_RX2, PIN_TX2);
  Serial.println("[ESP32] UART2 initialised at 9600 baud (GPIO16 RX / GPIO17 TX)");
  Serial.println("[ESP32] NOTE: GPIO16 RX is NOT connected in Phase 1 (level shifter required)");

  tracker.startMs = millis();

  // --- Wi-Fi ---
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[ESP32] Connecting to: ");
  Serial.print(WIFI_SSID);
  Serial.print(" ...");

  // Keep trying for 30 seconds (60 x 500ms)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    Serial.print(".");
    attempts++;
    // Every 10 attempts, restart the connection
    if (attempts % 10 == 0 && WiFi.status() != WL_CONNECTED) {
      Serial.println(" retrying...");
      WiFi.disconnect();
      delay(500);
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[ESP32] Connected to: ");
    Serial.println(WIFI_SSID);
    Serial.print("[ESP32] IP address: ");
    Serial.println(WiFi.localIP());
    Serial.println("[ESP32] Update web/.env.local with this IP address.");
  } else {
    Serial.println("\n[ESP32] STA failed — starting AP fallback mode");
    WiFi.softAP(AP_SSID, AP_PASS);
    Serial.print("[ESP32] AP SSID: ");
    Serial.println(AP_SSID);
    Serial.print("[ESP32] AP IP:   ");
    Serial.println(WiFi.softAPIP());
    Serial.println("[ESP32] Connect your device to NAVIC-TRACK-AP then browse to 192.168.4.1");
  }

  // --- REST endpoints ---
  const char* authHeaders[] = { "Authorization", "X-API-Key" };
  server.collectHeaders(authHeaders, 2);

  server.on("/api/v1/status",          HTTP_GET,  handleStatus);
  server.on("/api/v1/move",            HTTP_POST, handleMove);
  server.on("/api/v1/stop",            HTTP_POST, handleStop);
  server.on("/api/v1/track",           HTTP_POST, handleTrack);
  server.on("/api/v1/home",            HTTP_POST, handleHome);
  server.on("/api/v1/estop",           HTTP_POST, handleEStop);
  server.on("/api/v1/estop/reset",     HTTP_POST, handleEStopReset);

  server.onNotFound([]() {
    sendError(404, "Endpoint not found on ESP32");
  });

  server.begin();
  Serial.println("[ESP32] HTTP server started on port 80");

  // Send initial PING to Arduino to check if it is responding
  sendToArduino("PING");
  pendingCmd = { CMD_SENT_PING, millis(), 0, 0 };
  lastPingMs = millis();
}

// ============================================================================
// loop()
// ============================================================================
void loop() {
  server.handleClient();

  unsigned long nowMs = millis();
  tracker.uptimeSec = (nowMs - tracker.startMs) / 1000;

  // --- Read Arduino serial (non-blocking, character by character) ---
  while (ArduinoSerial.available() > 0) {
    char c = (char)ArduinoSerial.read();
    if (c == '\n' || c == '\r') {
      if (arduinoBufLen > 0) {
        arduinoBuf[arduinoBufLen] = '\0';
        processArduinoLine(arduinoBuf);
        arduinoBufLen = 0;
      }
    } else if (arduinoBufLen < ARDUINO_BUF_SIZE - 1) {
      arduinoBuf[arduinoBufLen++] = c;
    } else {
      // Buffer overflow — discard and reset
      arduinoBufLen = 0;
    }
  }

  // --- Hardware probe: periodic PING to Arduino ---
  if (nowMs - lastPingMs > HW_PROBE_INTERVAL_MS) {
    lastPingMs = nowMs;
    sendToArduino("PING");
    pendingCmd = { CMD_SENT_PING, millis(), 0, 0 };
  }

  // --- Hardware disconnect detection ---
  if (tracker.hwConn != HW_UNKNOWN) {
    if (nowMs - tracker.lastArduinoResponseMs > HW_DISCONNECT_TIMEOUT) {
      if (tracker.hwConn == HW_CONNECTED) {
        Serial.println("[ESP32] WARNING: Arduino not responding — marking DISCONNECTED");
        tracker.hwConn   = HW_DISCONNECTED;
        tracker.stateStr = "ERROR";
        tracker.lastError = "Arduino communication lost";
      }
    }
  }

  // --- Command timeout ---
  if (pendingCmd.type != CMD_NONE && pendingCmd.type != CMD_SENT_PING) {
    if (nowMs - pendingCmd.sentMs > CMD_TIMEOUT_MS) {
      Serial.print("[ESP32] Command timeout for type ");
      Serial.println(pendingCmd.type);
      tracker.stateStr  = "ERROR";
      tracker.lastError = "Command acknowledgement timeout";
      pendingCmd.type   = CMD_NONE;
    }
  }

  // --- Periodic Arduino STATUS poll (every 2 seconds when moving) ---
  static unsigned long lastStatusPollMs = 0;
  if ((tracker.stateStr == "SLEWING" || tracker.stateStr == "HOMING") &&
      nowMs - lastStatusPollMs > 2000) {
    lastStatusPollMs = nowMs;
    sendToArduino("STATUS");
  }
}
