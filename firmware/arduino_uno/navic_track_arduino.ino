/*
 * CODE 2: NAVIC-TRACK Motor Controller (Arduino Uno)
 * Dual 28BYJ-48 Steppers + ULN2003 Drivers
 * Azimuth: Pins 8, 9, 10, 11 | Elevation: Pins 4, 5, 6, 7
 * ESP32 Link: Pin 2 (RX) -> ESP32 Pin 17, Pin 3 (TX) -> ESP32 Pin 16
 */

#include <SoftwareSerial.h>

SoftwareSerial espSerial(2, 3); // RX=2, TX=3

const int AZ_PINS[4] = {8, 9, 10, 11};
const int EL_PINS[4] = {4, 5, 6, 7};

const int sequence[8][4] = {
  {1,0,0,0}, {1,1,0,0}, {0,1,0,0}, {0,1,1,0},
  {0,0,1,0}, {0,0,1,1}, {0,0,0,1}, {1,0,0,1}
};

int azStepIndex = 0;
int elStepIndex = 0;

float currentAzimuth = 0.0;
float currentElevation = 0.0;
bool isMoving = false;
unsigned long lastStatusTime = 0;

const int JOG_STEPS = 256;
const float DEGREES_PER_JOG = (360.0 / 4096.0) * JOG_STEPS;

void releaseMotor(const int pins[]) {
  for (int i = 0; i < 4; i++) digitalWrite(pins[i], LOW);
}

void rotateElevation(int direction, int steps) {
  isMoving = true;
  sendStatus();
  for (int step = 0; step < steps; step++) {
    for (int i = 0; i < 4; i++) digitalWrite(EL_PINS[i], sequence[elStepIndex][i]);
    elStepIndex += direction;
    if (elStepIndex >= 8) elStepIndex = 0;
    if (elStepIndex < 0) elStepIndex = 7;
    delay(6);
  }
  isMoving = false;
  sendStatus();
}

void rotateAzimuth(int direction, int steps) {
  isMoving = true;
  sendStatus();
  for (int step = 0; step < steps; step++) {
    for (int i = 0; i < 4; i++) digitalWrite(AZ_PINS[i], sequence[azStepIndex][i]);
    azStepIndex += direction;
    if (azStepIndex >= 8) azStepIndex = 0;
    if (azStepIndex < 0) azStepIndex = 7;
    delay(4);
  }
  releaseMotor(AZ_PINS);
  isMoving = false;
  sendStatus();
}

void sendStatus() {
  String msg = "STATUS:" + String(currentAzimuth, 1) + "," + String(currentElevation, 1) + "," + String(isMoving ? 1 : 0);
  Serial.println(msg);
  espSerial.println(msg);
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd == "AZ_CW") {
    rotateAzimuth(1, JOG_STEPS);
    currentAzimuth += DEGREES_PER_JOG;
    if (currentAzimuth >= 360.0) currentAzimuth -= 360.0;
  }
  else if (cmd == "AZ_CCW") {
    rotateAzimuth(-1, JOG_STEPS);
    currentAzimuth -= DEGREES_PER_JOG;
    if (currentAzimuth < 0.0) currentAzimuth += 360.0;
  }
  else if (cmd == "EL_CW" || cmd == "EL_UP") {
    rotateElevation(1, JOG_STEPS);
    currentElevation = min(90.0, currentElevation + DEGREES_PER_JOG);
  }
  else if (cmd == "EL_CCW" || cmd == "EL_DOWN") {
    rotateElevation(-1, JOG_STEPS);
    currentElevation = max(0.0, currentElevation - DEGREES_PER_JOG);
  }
  else if (cmd == "STOP") {
    releaseMotor(AZ_PINS);
    releaseMotor(EL_PINS);
    isMoving = false;
  }
  else if (cmd == "HOME") {
    releaseMotor(AZ_PINS);
    releaseMotor(EL_PINS);
    currentAzimuth = 0.0;
    currentElevation = 0.0;
    isMoving = false;
  }
  else if (cmd == "TEST_EL") {
    rotateElevation(1, 256);
    delay(400);
    rotateElevation(-1, 256);
  }
  else if (cmd.startsWith("GOTO,")) {
    int c1 = cmd.indexOf(',');
    int c2 = cmd.indexOf(',', c1 + 1);
    if (c1 != -1 && c2 != -1) {
      float targetAz = cmd.substring(c1 + 1, c2).toFloat();
      float targetEl = cmd.substring(c2 + 1).toFloat();

      float diffAz = targetAz - currentAzimuth;
      if (abs(diffAz) >= 1.5) {
        int dir = (diffAz > 0) ? 1 : -1;
        int steps = (int)(abs(diffAz) * (4096.0 / 360.0));
        steps = min(steps, 1024);
        rotateAzimuth(dir, steps);
        currentAzimuth += dir * (steps * (360.0 / 4096.0));
        if (currentAzimuth >= 360.0) currentAzimuth -= 360.0;
        if (currentAzimuth < 0.0) currentAzimuth += 360.0;
      }

      float diffEl = targetEl - currentElevation;
      if (abs(diffEl) >= 1.5) {
        int dir = (diffEl > 0) ? 1 : -1;
        int steps = (int)(abs(diffEl) * (4096.0 / 360.0));
        steps = min(steps, 1024);
        rotateElevation(dir, steps);
        currentElevation += dir * (steps * (360.0 / 4096.0));
        currentElevation = constrain(currentElevation, 0.0, 90.0);
      }
    }
  }

  sendStatus();
}

void setup() {
  Serial.begin(9600);
  espSerial.begin(9600);

  for (int i = 0; i < 4; i++) {
    pinMode(AZ_PINS[i], OUTPUT);
    pinMode(EL_PINS[i], OUTPUT);
  }

  releaseMotor(AZ_PINS);
  releaseMotor(EL_PINS);
  sendStatus();
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    processCommand(command);
  }
  if (espSerial.available()) {
    String command = espSerial.readStringUntil('\n');
    processCommand(command);
  }
  if (millis() - lastStatusTime >= 1000) {
    lastStatusTime = millis();
    sendStatus();
  }
}
