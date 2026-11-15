/*
 * CODE 1: NAVIC-TRACK ESP32 Controller (Non-Blocking High Speed)
 * Wi-Fi: Bilha | Port: 8080 | UDP Beacon: 8888
 * Wires:
 *   GPIO 16 (RX2) -> Arduino Pin 3 (TX)
 *   GPIO 17 (TX2) -> Arduino Pin 2 (RX)
 *   GND           -> Arduino GND
 */

#include <WiFi.h>
#include <WebServer.h>
#include <WiFiUdp.h>

const char* ssid = "Bilha";
const char* password = "crysta2333";

// AP Fallback if Wi-Fi cannot connect
const char* ap_ssid = "NAVIC-TRACK-AP";
const char* ap_password = "navic1234";

WebServer server(8080);
WiFiUDP udp;
const int UDP_PORT = 8888;

#define ESP_RX2 16
#define ESP_TX2 17

float currentAz = 0.0;
float currentEl = 0.0;
bool isMoving = false;
unsigned long lastBeaconTime = 0;
String serial2Buffer = "";

void handleCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With,*");
  server.sendHeader("Access-Control-Max-Age", "86400");
}

void handleOptions() {
  handleCors();
  server.send(204);
}

void handleStatus() {
  handleCors();
  String json = "{\"success\":true,\"data\":{\"state\":\"" + String(isMoving ? "SLEWING" : "IDLE") + "\",\"homed\":true,\"currentAngles\":{\"azimuth\":" + String(currentAz, 1) + ",\"elevation\":" + String(currentEl, 1) + "},\"targetAngles\":{\"azimuth\":" + String(currentAz, 1) + ",\"elevation\":" + String(currentEl, 1) + "},\"satelliteName\":\"NAVIC-1B\",\"noradId\":39635,\"isVisible\":true}}";
  server.send(200, "application/json", json);
}

void handleMove() {
  handleCors();
  String cmd = "";
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    body.trim();
    if (body.startsWith("GOTO,")) {
      cmd = body;
    } else if (body.startsWith("{")) {
      float az = currentAz;
      float el = currentEl;
      int azIdx = body.indexOf("\"azimuth\":");
      int elIdx = body.indexOf("\"elevation\":");
      if (azIdx != -1) az = body.substring(azIdx + 10).toFloat();
      if (elIdx != -1) el = body.substring(elIdx + 12).toFloat();
      cmd = "GOTO," + String(az, 1) + "," + String(el, 1);
    } else {
      cmd = body;
    }
  }
  cmd.trim();
  if (cmd.length() > 0) {
    Serial2.println(cmd);
    Serial.print("[MOVE] Forwarded to Arduino: ");
    Serial.println(cmd);
  }
  server.send(200, "application/json", "{\"success\":true,\"data\":{\"message\":\"Command sent: " + cmd + "\"}}");
}

void handleJog() {
  handleCors();
  String cmd = "";
  if (server.hasArg("cmd")) {
    cmd = server.arg("cmd");
  } else if (server.hasArg("plain")) {
    String body = server.arg("plain");
    body.trim();
    if (body.startsWith("{")) {
      if (body.indexOf("TEST_EL") != -1) cmd = "TEST_EL";
      else if (body.indexOf("ELEVATION") != -1 || body.indexOf("\"EL\"") != -1 || body.indexOf("EL_") != -1) {
        if (body.indexOf("CCW") != -1 || body.indexOf("DOWN") != -1) cmd = "EL_CCW";
        else cmd = "EL_CW";
      } else if (body.indexOf("AZIMUTH") != -1 || body.indexOf("\"AZ\"") != -1 || body.indexOf("AZ_") != -1) {
        if (body.indexOf("CCW") != -1 || body.indexOf("RIGHT") != -1) cmd = "AZ_CCW";
        else cmd = "AZ_CW";
      } else if (body.indexOf("EL_CW") != -1) cmd = "EL_CW";
      else if (body.indexOf("EL_CCW") != -1) cmd = "EL_CCW";
      else if (body.indexOf("AZ_CW") != -1) cmd = "AZ_CW";
      else if (body.indexOf("AZ_CCW") != -1) cmd = "AZ_CCW";
    } else {
      cmd = body;
    }
  }
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() > 0) {
    Serial2.println(cmd);
    Serial.print("[JOG] Forwarded to Arduino: ");
    Serial.println(cmd);
  }
  server.send(200, "application/json", "{\"success\":true,\"data\":{\"message\":\"Jog forwarded: " + cmd + "\"}}");
}

void handleStop() {
  handleCors();
  Serial2.println("STOP");
  server.send(200, "application/json", "{\"success\":true,\"data\":{\"state\":\"IDLE\"}}");
}

void handleHome() {
  handleCors();
  Serial2.println("HOME");
  currentAz = 0.0;
  currentEl = 0.0;
  server.send(200, "application/json", "{\"success\":true,\"data\":{\"message\":\"Homed\"}}");
}

void sendDiscoveryBeacon() {
  IPAddress ip = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP() : WiFi.softAPIP();
  udp.beginPacket(IPAddress(255, 255, 255, 255), UDP_PORT);
  String beacon = "{\"device\":\"NAVIC-TRACK-ESP32\",\"ip\":\"" + ip.toString() + "\",\"port\":8080,\"azimuth\":" + String(currentAz, 1) + ",\"elevation\":" + String(currentEl, 1) + ",\"isMoving\":" + (isMoving ? "true" : "false") + "}";
  udp.print(beacon);
  udp.endPacket();
}

// 100% Non-blocking character reader for Arduino Serial
void readArduinoSerial() {
  while (Serial2.available() > 0) {
    char c = (char)Serial2.read();
    if (c == '\n' || c == '\r') {
      serial2Buffer.trim();
      if (serial2Buffer.startsWith("STATUS:")) {
        int c1 = serial2Buffer.indexOf(',');
        int c2 = serial2Buffer.indexOf(',', c1 + 1);
        if (c1 != -1 && c2 != -1) {
          currentAz = serial2Buffer.substring(7, c1).toFloat();
          currentEl = serial2Buffer.substring(c1 + 1, c2).toFloat();
          isMoving = (serial2Buffer.substring(c2 + 1).toInt() == 1);
        }
      }
      serial2Buffer = "";
    } else {
      if (serial2Buffer.length() < 64) {
        serial2Buffer += c;
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n========================================");
  Serial.println("[ESP32] NAVIC-TRACK Controller Starting");
  Serial.println("========================================");

  // Initialize hardware serial to Arduino (UART2)
  Serial2.begin(9600, SERIAL_8N1, ESP_RX2, ESP_TX2);
  Serial2.setTimeout(50);
  Serial.println("[ESP32] UART2 initialized: GPIO16 (RX) <-> GPIO17 (TX) at 9600 baud");

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[ESP32] Connecting to Wi-Fi '");
  Serial.print(ssid);
  Serial.print("'");

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n\n**************************************************");
    Serial.println(">>> [ESP32] WI-FI CONNECTED SUCCESSFULLY! <<<");
    Serial.print(">>> YOUR ESP32 IP IS: http://");
    Serial.print(WiFi.localIP());
    Serial.println(":8080 <<<");
    Serial.println("**************************************************\n");
    udp.begin(UDP_PORT);
    sendDiscoveryBeacon();
  } else {
    Serial.println("\n\n[ESP32] Station mode failed! Starting AP fallback...");
    WiFi.softAP(ap_ssid, ap_password);
    Serial.println("**************************************************");
    Serial.print(">>> CONNECT WI-FI TO: ");
    Serial.println(ap_ssid);
    Serial.print(">>> PASSWORD: ");
    Serial.println(ap_password);
    Serial.print(">>> AP IP ADDRESS: http://");
    Serial.print(WiFi.softAPIP());
    Serial.println(":8080 <<<");
    Serial.println("**************************************************\n");
    udp.begin(UDP_PORT);
  }

  // Configure REST Endpoints
  server.on("/api/v1/status", HTTP_GET, handleStatus);
  server.on("/api/v1/status", HTTP_OPTIONS, handleOptions);
  server.on("/api/v1/move",   HTTP_POST, handleMove);
  server.on("/api/v1/move",   HTTP_OPTIONS, handleOptions);
  server.on("/api/v1/jog",    HTTP_POST, handleJog);
  server.on("/api/v1/jog",    HTTP_OPTIONS, handleOptions);
  server.on("/api/v1/stop",   HTTP_POST, handleStop);
  server.on("/api/v1/stop",   HTTP_OPTIONS, handleOptions);
  server.on("/api/v1/home",   HTTP_POST, handleHome);
  server.on("/api/v1/home",   HTTP_OPTIONS, handleOptions);

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
    } else {
      server.send(404, "text/plain", "Not Found");
    }
  });

  server.begin();
  Serial.println("[ESP32] HTTP REST Server active on port 8080");
  Serial.println("[ESP32] Ready to track satellites and rotate motors!\n");
}

void loop() {
  server.handleClient();
  readArduinoSerial();

  int packetSize = udp.parsePacket();
  if (packetSize > 0) {
    char buf[128];
    int len = udp.read(buf, sizeof(buf) - 1);
    if (len > 0) {
      buf[len] = '\0';
      String cmd = String(buf);
      cmd.trim();
      if (cmd.length() > 0) {
        Serial2.println(cmd);
        Serial.print("[UDP] Command forwarded: ");
        Serial.println(cmd);
      }
    }
  }

  if (millis() - lastBeaconTime >= 1000) {
    lastBeaconTime = millis();
    sendDiscoveryBeacon();
  }
}
