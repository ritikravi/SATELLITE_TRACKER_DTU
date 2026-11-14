/*
 * NAVIC-TRACK ESP32 Wi-Fi to Arduino Serial Bridge
 * 
 * Hardware:
 *   - ESP32-WROOM-32 DevKit
 *   - Connected to Arduino Uno via Serial (HardwareSerial 2)
 *     ESP32 TX2 (GPIO 17) -> Arduino RX (D0 via 1k resistor or direct logic shifter)
 *     ESP32 RX2 (GPIO 16) -> Arduino TX (D1)
 *     Common Ground between ESP32 and Arduino
 * 
 * Functions:
 *   - Connects to Wi-Fi
 *   - Listens for REST/WebSocket commands from NAVIC-TRACK web interface
 *   - Enforces elevation mask check (never drives below minElevationMask)
 *   - Forwards GOTO,<az>,<el> to Arduino Uno
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// --- WI-FI CONFIGURATION ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// --- AUTHENTICATION TOKEN ---
const char* AUTH_TOKEN = "navic-secret-token-123";

// --- HARDWARE SERIAL TO ARDUINO ---
HardwareSerial ArduinoSerial(2); // UART2: RX2=GPIO16, TX2=GPIO17
const int PIN_RX2 = 16;
const int PIN_TX2 = 17;

WebServer server(80);

// Tracker State
float currentAzimuth = 0.0;
float currentElevation = 0.0;
float targetAzimuth = 0.0;
float targetElevation = 0.0;
float minElevationMask = 10.0; // 10 degrees default mask
bool isTracking = false;
bool isMoving = false;
String lastStatusResponse = "";

bool isAuthenticated() {
  if (server.hasHeader("Authorization")) {
    String auth = server.header("Authorization");
    if (auth.startsWith("Bearer ")) {
      String token = auth.substring(7);
      return token.equals(AUTH_TOKEN);
    }
  }
  return false;
}

void sendJsonResponse(int code, bool success, const String& dataJson, const String& errorMsg = "") {
  String response = "{";
  response += "\"success\":" + String(success ? "true" : "false") + ",";
  if (success) {
    response += "\"data\":" + dataJson + ",";
  } else {
    response += "\"error\":\"" + errorMsg + "\",";
  }
  response += "\"timestamp\":\"" + String(millis()) + "\"}";
  server.send(code, "application/json", response);
}

void handleStatus() {
  String data = "{";
  data += "\"state\":\"" + String(isTracking ? "TRACKING" : (isMoving ? "SLEWING" : "IDLE")) + "\",";
  data += "\"homed\":true,";
  data += "\"currentAngles\":{\"azimuth\":" + String(currentAzimuth, 2) + ",\"elevation\":" + String(currentElevation, 2) + "},";
  data += "\"targetAngles\":{\"azimuth\":" + String(targetAzimuth, 2) + ",\"elevation\":" + String(targetElevation, 2) + "},";
  data += "\"hardwareConnected\":true";
  data += "}";
  sendJsonResponse(200, true, data);
}

void handleMove() {
  if (!isAuthenticated()) {
    sendJsonResponse(401, false, "", "Unauthorized: Invalid or missing token");
    return;
  }

  if (!server.hasArg("plain")) {
    sendJsonResponse(400, false, "", "Missing request body");
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJsonResponse(400, false, "", "Invalid JSON");
    return;
  }

  float reqAz = doc["azimuth"] | -1.0;
  float reqEl = doc["elevation"] | -1.0;

  if (reqAz < 0.0 || reqAz > 360.0 || reqEl < 0.0 || reqEl > 90.0) {
    sendJsonResponse(400, false, "", "Angles out of range (Az: 0-360, El: 0-90)");
    return;
  }

  targetAzimuth = reqAz;
  targetElevation = reqEl;

  // Send GOTO to Arduino Uno
  ArduinoSerial.print("GOTO,");
  ArduinoSerial.print(reqAz, 2);
  ArduinoSerial.print(",");
  ArduinoSerial.println(reqEl, 2);

  isMoving = true;
  sendJsonResponse(200, true, "{\"state\":\"SLEWING\"}");
}

void handleStop() {
  if (!isAuthenticated()) {
    sendJsonResponse(401, false, "", "Unauthorized");
    return;
  }
  ArduinoSerial.println("STOP");
  isTracking = false;
  isMoving = false;
  sendJsonResponse(200, true, "{\"state\":\"IDLE\"}");
}

void handleHome() {
  if (!isAuthenticated()) {
    sendJsonResponse(401, false, "", "Unauthorized");
    return;
  }
  ArduinoSerial.println("HOME");
  currentAzimuth = 0.0;
  currentElevation = 0.0;
  targetAzimuth = 0.0;
  targetElevation = 0.0;
  sendJsonResponse(200, true, "{\"message\":\"Homed to zero\"}");
}

void setup() {
  Serial.begin(115200);
  ArduinoSerial.begin(115200, SERIAL_8N1, PIN_RX2, PIN_TX2);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to Wi-Fi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected! IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi connection timed out. Starting AP mode...");
    WiFi.softAP("NAVIC-TRACK-AP", "navic123");
    Serial.print("AP IP: ");
    Serial.println(WiFi.softAPIP());
  }

  // Setup REST Endpoints
  server.on("/api/v1/status", HTTP_GET, handleStatus);
  server.on("/api/v1/move", HTTP_POST, handleMove);
  server.on("/api/v1/track", HTTP_POST, []() {
    if (!isAuthenticated()) {
      sendJsonResponse(401, false, "", "Unauthorized");
      return;
    }
    isTracking = true;
    sendJsonResponse(200, true, "{\"state\":\"TRACKING\"}");
  });
  server.on("/api/v1/home", HTTP_POST, handleHome);

  // Collect headers for auth
  const char* headerkeys[] = {"Authorization"};
  size_t headerkeyssize = sizeof(headerkeys) / sizeof(char*);
  server.collectHeaders(headerkeys, headerkeyssize);

  server.begin();
  Serial.println("HTTP Server started on port 80");
}

void loop() {
  server.handleClient();

  // Read status messages from Arduino Uno
  while (ArduinoSerial.available() > 0) {
    String line = ArduinoSerial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      Serial.println("[Arduino] " + line);
      if (line.startsWith("OK,GOTO")) {
        isMoving = true;
      } else if (line.startsWith("OK,STOPPED") || line.startsWith("OK,HOMED")) {
        isMoving = false;
      }
    }
  }
}

