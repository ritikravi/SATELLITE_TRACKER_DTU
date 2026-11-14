# NAVIC-TRACK — Phase 1 Project Audit
**Date:** 2025-07  
**Auditor:** Lead Systems Engineer  
**Scope:** Full codebase, firmware, hardware configuration, protocol design, security

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Current Architecture](#2-current-architecture)
3. [Completed & Working Functionality](#3-completed--working-functionality)
4. [Mock / Fake Functionality](#4-mock--fake-functionality)
5. [Missing Functionality](#5-missing-functionality)
6. [Hardware Integration Gaps](#6-hardware-integration-gaps)
7. [Firmware Bugs — Critical](#7-firmware-bugs--critical)
8. [GPIO Conflicts and Pin Mapping](#8-gpio-conflicts-and-pin-mapping)
9. [Motor Calibration Uncertainties](#9-motor-calibration-uncertainties)
10. [TLE Data Issues](#10-tle-data-issues)
11. [Security Findings](#11-security-findings)
12. [State Machine Gaps](#12-state-machine-gaps)
13. [Duplicate Code Paths](#13-duplicate-code-paths)
14. [Implementation Plan — Phases 2–9](#14-implementation-plan--phases-29)
15. [File-by-File Status Summary](#15-file-by-file-status-summary)

---

## 1. Repository Structure

```
vihaan_hardware-main 5/
├── docs/                        ← API.md exists; audit added here
├── firmware/
│   ├── arduino_rotator/
│   │   └── arduino_rotator.ino  ← EXISTS, has critical bugs
│   └── esp32_bridge/
│       └── esp32_bridge.ino     ← EXISTS, has critical bugs
├── mock-server/                 ← Node/TypeScript mock, fully functional
│   └── src/
│       ├── index.ts             ← 19 REST endpoints + WebSocket
│       ├── state.ts             ← Simulation physics tick
│       ├── simulator.ts         ← Real SGP4 via satellite.js
│       ├── tle-data.ts          ← CelesTrak fetcher + fallbacks
│       ├── auth.ts              ← Bearer token + rate limiting
│       └── jarvis/              ← AI assistant bridge
├── openjarvis-service/
│   └── server.py                ← FastAPI Jarvis service
├── orbit-engine/                ← DOES NOT EXIST YET (to be created)
├── shared/
│   └── types/tracker.ts         ← Shared TypeScript types
├── web/                         ← Next.js 16 dashboard
│   └── src/
│       ├── app/                 ← 6 pages + catch-all API proxy
│       ├── components/          ← Dashboard, control, TLE, logs, Jarvis UI
│       ├── context/             ← TrackerContext WebSocket manager
│       ├── lib/
│       │   ├── api.ts           ← Typed API client
│       │   ├── decoder.ts       ← Lean WS packet decoder
│       │   └── server/          ← DUPLICATE server state (see §13)
│       └── types/tracker.ts     ← DUPLICATE of shared/types (see §13)
└── tests/                       ← DOES NOT EXIST YET (to be created)
```

---

## 2. Current Architecture

### What is actually running

```
Browser (Next.js :3000)
    │
    ├─── REST polling + WebSocket ──► Mock Server (Node.js :8080)
    │                                      │
    │                                      ├─ satellite.js SGP4 (real math)
    │                                      ├─ CelesTrak TLE fetch (real network)
    │                                      ├─ Physics simulation loop (fake motors)
    │                                      └─ Jarvis bridge → openjarvis-service :8100
    │
    └─── Relative API proxy ──────► Next.js API route (/api/v1/[...slug])
                                         │
                                         └─ Duplicate server state (web/src/lib/server/)
```

### What is NOT connected

```
ESP32 firmware   ─── NOT connected to anything ───  (exists as .ino file only)
Arduino firmware ─── NOT connected to anything ───  (exists as .ino file only)
28BYJ-48 motors  ─── NOT controlled              ───  (hardware exists)
MPU-6050         ─── NOT read                    ───  (hardware exists)
Limit switches   ─── NOT wired or coded          ───  (hardware exists)
```

The web dashboard is talking exclusively to the mock Node.js server, which simulates motor physics in software. No physical hardware is connected to any software component.

---

## 3. Completed & Working Functionality

### Web Dashboard (all 6 pages working)
- ✅ Overview page with BOM, roadmap, live status ribbon
- ✅ Dashboard with polar sky plot, Az/El gauges, 3D Earth scene, next pass card
- ✅ Control page with satellite picker, manual jog, homing button, confirmation modals
- ✅ TLE page with editor, checksum validator, preset loader, file upload
- ✅ Settings page with observer coordinates, motor calibration fields
- ✅ Logs page with SVG chart, telemetry table, IndexedDB persistence, CSV export

### Mock Server (fully functional simulation)
- ✅ All 19 REST endpoints with correct response envelopes
- ✅ WebSocket at 1 Hz with lean telemetry packets (<300 bytes)
- ✅ Real SGP4 propagation using `satellite.js` (actual orbital math)
- ✅ Live TLE fetch from CelesTrak with fallback and 4-hour cache
- ✅ Bearer token authentication with rate limiting (5 attempts → 30s lockout)
- ✅ Motor speed clamping at ≤5°/s
- ✅ Soft angle bounds enforcement (Az 0–360, El 0–90)
- ✅ Pass prediction (AOS/LOS/TCA) using real SGP4
- ✅ Satellite catalog with live CelesTrak search
- ✅ Jarvis AI bridge to openjarvis-service

### Orbital Calculations
- ✅ SGP4 propagation (satellite.js) — real orbital math
- ✅ Observer-relative Az/El calculation
- ✅ Sub-satellite point (lat/lon/alt)
- ✅ Visibility above elevation mask
- ✅ Binary-search pass refinement for accurate AOS/LOS

### Shared Infrastructure
- ✅ Typed API contracts in `shared/types/tracker.ts`
- ✅ Lean telemetry packet format with decoder
- ✅ TrackerContext WebSocket manager with exponential backoff
- ✅ localStorage auth token with Bearer header injection

---

## 4. Mock / Fake Functionality

These items exist in the codebase and appear functional but are **not real**. Each must be clearly labelled or replaced.

### 4.1 Motor physics simulation (FAKE)
**File:** `mock-server/src/state.ts` — simulation physics tick (setInterval 100ms)  
The motor position is computed by incrementing `currentAngles` toward `targetAngles` at a configured `deg/s` rate. This is pure software arithmetic. No physical motor is involved. The position reported as "current" is a simulated estimate, not a measured angle.  
**Risk:** Dashboard shows smooth tracking that makes hardware appear to work when it does not.

### 4.2 `hardwareConnected: true` (FAKE)
**File:** `web/src/lib/server/state.ts`, line `hardwareConnected: true`  
This flag is hardcoded to `true` in the Next.js API route's server state. It never checks whether a real ESP32 is connected. Any user of the Next.js API route (not the mock server) sees a falsely connected hardware status.  
**Risk:** Operator cannot distinguish simulation from real hardware.

### 4.3 `homed: true` (FAKE)
**File:** `web/src/lib/server/state.ts` and `mock-server/src/state.ts`  
`homed: true` is set as the initial state without any homing sequence having occurred. The mount is not known to be at its reference position at boot.  
**Risk:** Any motor movement from a non-homed position can physically crash the mount against mechanical stops.

### 4.4 IMU data (FAKE)
**File:** `mock-server/src/simulator.ts` — `simulateImu()`  
**File:** `web/src/lib/server/state.ts` — `Math.sin(now.getTime() / 4000)`  
MPU-6050 values are generated by sinusoidal functions with small random noise. No I2C communication occurs.

### 4.5 Log tracking error (FAKE)
**File:** `web/src/lib/server/state.ts` — `getLiveLogs()`  
```typescript
const error = Math.abs((Math.sin(i * 0.4) * 0.3) + 0.15);
```
Tracking error values in the logs are fabricated using a sine function. The dashboard chart shows these as if they were real pointing residuals.

### 4.6 RSSI values (FAKE)
**File:** `mock-server/src/index.ts`  
```typescript
rssi: -55 - Math.floor(Math.random() * 8)
```
Wi-Fi RSSI is randomly generated per telemetry packet. No real ESP32 RSSI is read.

### 4.7 Homing sequence (FAKE)
**File:** `mock-server/src/state.ts` — `startHoming()`  
Homing sets `state = 'HOMING'` and moves the simulated position toward 0°/0°. No limit switches are engaged. No physical endstop is detected.

### 4.8 `web/src/lib/server/state.ts` jitter (MISLEADING)
```typescript
const jitterAz = Math.sin(now.getTime() / 1800) * 0.15;
```
Presented as "realistic tracking with 28BYJ-48 stepper precision" — this is a sine wave, not stepper behavior.

---

## 5. Missing Functionality

### 5.1 Python orbit engine — NOT EXISTS
No Python/FastAPI orbit service exists. The orbit-engine directory is empty. The master spec requires a Python SGP4 service (Skyfield or equivalent) as the authoritative orbit calculation backend.

### 5.2 Hardware serial bridge — NOT FUNCTIONAL
The ESP32 firmware has an HTTP server and UART code, but:
- It is not compiled or flashed.
- It is not connected to the Node.js mock server.
- It has critical bugs (see §7).

### 5.3 Real hardware status reporting
No code currently reads actual hardware state. The system cannot report whether the ESP32 is physically online, whether the Arduino is responding, or whether the motors are stalled.

### 5.4 Automated tests — NOT EXISTS
The `tests/` directory is empty. No unit tests, integration tests, or hardware simulation tests exist.

### 5.5 TLE age validation and policy enforcement
TLE age is tracked (`updatedAt` field) but there is no policy that blocks tracking commands when TLEs exceed a configurable maximum age (e.g. 7 days).

### 5.6 Emergency stop
No `EMERGENCY_STOP` state exists in the type system or in any firmware. No dedicated emergency stop endpoint exists in the API.

### 5.7 Real limit switch protection
Arduino firmware has no GPIO assigned to limit switches and no interrupt-based stop logic.

### 5.8 Acceleration/deceleration profiles
Arduino firmware uses a fixed step interval with no ramp-up or ramp-down. This risks stepper stall on sudden direction changes or high-speed starts.

### 5.9 Communication-loss stop
If the ESP32 loses its Wi-Fi connection or the backend stops sending commands, the motors have no timeout that would halt movement. The Arduino firmware has no watchdog for absent serial commands.

### 5.10 Bidirectional Arduino telemetry
The Arduino firmware sends `STATUS,AZ=...,EL=...` responses, but the ESP32 firmware only uses them for console logging. Status is never forwarded to the web backend.

### 5.11 Hardware mode labelling in dashboard
The dashboard does not display whether it is in `SIMULATION`, `MOCK`, or `HARDWARE_CONNECTED` mode. No `hardware_mode` field exists in API responses.

### 5.12 Calibration wizard
A guided calibration procedure for steps-per-degree is specified but not implemented.

---

## 6. Hardware Integration Gaps

### 6.1 ESP32 ↔ Backend connection
The real ESP32 runs its own HTTP server on port 80. The mock server runs on port 8080. The Next.js web app points to `http://localhost:8080` by default. To use real hardware, `web/.env.local` must be created with the ESP32's IP address. No `.env.local` exists.

### 6.2 ESP32 ↔ Arduino UART baud rate
**Critical.** See §7.1.

### 6.3 Arduino SoftwareSerial not implemented
The Arduino firmware listens on `Serial` (hardware UART, pins D0/D1). The ESP32 is wired to D2/D3 for SoftwareSerial. The Arduino firmware has no `SoftwareSerial` import, no instance, and never reads from D2. Commands from the ESP32 are physically arriving at D2 but the Arduino firmware never reads that pin.

### 6.4 Level shifter requirement
Arduino D3 TX output is 5V logic. ESP32 GPIO16 RX is 3.3V-only. A direct wire would apply 5V to a 3.3V input, which risks damaging the ESP32. The spec allows two 1.8kΩ resistors for a voltage divider (~2.5V output), but this is marginal. A proper level shifter (e.g. TXS0101 or 10kΩ/20kΩ divider) is required before bidirectional UART is enabled. **Phase 1: transmit one-way only (ESP32→Arduino). Do not connect Arduino TX→ESP32 RX until a verified level shifter is in place.**

### 6.5 MPU-6050 wiring not verified
The Arduino firmware has no MPU-6050 code. The ESP32 firmware has no MPU-6050 code. The I2C address (0x68) and wiring to SDA/SCL are documented in NAVIC-TRACK.md but never implemented.

### 6.6 Limit switch wiring not verified
No limit switch GPIO assignments exist in any firmware file. NAVIC-TRACK.md documents GPIO 32, 33 on ESP32, but this conflicts with the Arduino-first architecture. The spec says limit switches connect to the Arduino Uno, not the ESP32.

### 6.7 External 5V power supply isolation
The Arduino firmware disables coils when idle, which is correct. However, there is no protection against a brownout on the 5V supply when both motors run simultaneously. Total current draw can reach ~1A. The supply must be rated ≥2A.

---

## 7. Firmware Bugs — Critical

### Bug 7.1 — UART Baud Rate Mismatch (CRITICAL — motors will not move)
**File:** `firmware/esp32_bridge/esp32_bridge.ino`
```cpp
ArduinoSerial.begin(115200, SERIAL_8N1, PIN_RX2, PIN_TX2);
```
**File:** `firmware/arduino_rotator/arduino_rotator.ino`
```cpp
Serial.begin(115200);
```
The ESP32 sends at 115200 baud over UART2 (GPIO17) to Arduino D2. D2 is a SoftwareSerial pin. SoftwareSerial on the Arduino Uno is not reliable at 115200 baud — the standard recommendation is ≤57600, with 9600–19200 being most reliable. Additionally, **the Arduino firmware does not instantiate SoftwareSerial at all**. It listens only on hardware `Serial` (D0/D1). Commands arriving on D2 are silently ignored.

**Fix required:**
- Arduino firmware: add `SoftwareSerial mySerial(2, 3)` and read commands from `mySerial` instead of `Serial`.
- Reduce baud rate to 9600 on both sides for reliable SoftwareSerial operation.

### Bug 7.2 — Motor Speed Way Too Fast (CRITICAL — motors will stall)
**File:** `firmware/arduino_rotator/arduino_rotator.ino`
```cpp
const unsigned long STEP_INTERVAL_MICROS = 2200;
```
At 2200 µs per half-step with 40.25 steps/degree:
```
steps/sec = 1,000,000 / 2200 = 454.5
deg/sec   = 454.5 / 40.25   = 11.3°/s
```
This is **more than double the maximum safe speed** (5°/s) for the 28BYJ-48 motor. At this rate the motor will stall, skip steps, and lose position.

**Fix required:**
- For 4°/s azimuth: interval = `1,000,000 / (4 × 40.25)` = **6,211 µs**
- For 3.5°/s elevation: interval = `1,000,000 / (3.5 × 40.43)` = **7,069 µs**
- Implement per-axis configurable intervals.

### Bug 7.3 — HOME Does Not Move to Limit Switches (FUNCTIONAL SAFETY)
**File:** `firmware/arduino_rotator/arduino_rotator.ino`
```cpp
} else if (cmd.equals("HOME")) {
    currentStepAz = 0;
    currentStepEl = 0;
    // ... zeros counters only
```
`HOME` only resets the step counter to zero. The mount is not physically moved to any reference position. After calling HOME, the firmware believes it is at 0°/0° regardless of where the antenna physically is.

**Fix required:** Implement real homing: drive both axes at slow speed toward limit switches, stop immediately on switch trigger, apply configurable back-off, then set zero.

### Bug 7.4 — ESP32 HOME Does Not Forward to Arduino
**File:** `firmware/esp32_bridge/esp32_bridge.ino`
```cpp
void handleHome() {
    ArduinoSerial.println("HOME");
    currentAzimuth = 0.0;   // ← sets ESP32 internal state
    currentElevation = 0.0; // ← before confirming Arduino responded
```
The ESP32 immediately marks its own position as 0,0 even before the Arduino acknowledges the HOME command. If the Arduino is not connected or the command is lost, the ESP32 state diverges from physical reality.

### Bug 7.5 — `isMoving` Never Cleared Correctly
**File:** `firmware/esp32_bridge/esp32_bridge.ino`
```cpp
isMoving = true; // set in handleMove()
// Never cleared except when Arduino sends "OK,STOPPED" or "OK,HOMED"
```
If the Arduino completes movement and enters idle state but its serial response is not received by the ESP32 (line noise, buffer overflow), `isMoving` stays `true` forever. The ESP32 state machine stalls.

### Bug 7.6 — No Command Acknowledgement Timeout
Neither the ESP32 nor the Arduino implements a timeout for unacknowledged commands. If a command is transmitted and lost, the system hangs in `isMoving = true` indefinitely. Required: configurable timeout (suggested: 60s) after which the state is reset and an error is reported.

### Bug 7.7 — Serial Input Buffer Not Size-Limited in ESP32
**File:** `firmware/esp32_bridge/esp32_bridge.ino`
```cpp
while (ArduinoSerial.available() > 0) {
    String line = ArduinoSerial.readStringUntil('\n');
```
`readStringUntil()` will block until a newline arrives or the serial buffer fills. If the Arduino sends malformed output or a very long line, this blocks the ESP32 `loop()` including the web server handler. Use non-blocking character-by-character accumulation with a fixed buffer and length limit.

### Bug 7.8 — ESP32 Hardcoded Credentials
**File:** `firmware/esp32_bridge/esp32_bridge.ino`
```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* AUTH_TOKEN = "navic-secret-token-123";
```
Wi-Fi SSID, password, and auth token are hardcoded. These must be moved to a configuration source (SPIFFS config file or compile-time defines from a gitignored header).

---

## 8. GPIO Conflicts and Pin Mapping

### Verified Clean Mapping (per spec §2.1 and §2.2)

| Signal | Pin | Conflict? | Note |
|--------|-----|-----------|------|
| Az IN1 | Arduino D8 | None | ✅ |
| Az IN2 | Arduino D9 | None | ✅ |
| Az IN3 | Arduino D10 | None | ✅ |
| Az IN4 | Arduino D11 | None | ✅ |
| El IN1 | Arduino D4 | None | ✅ |
| El IN2 | Arduino D5 | None | ✅ |
| El IN3 | Arduino D6 | None | ✅ |
| El IN4 | Arduino D7 | None | ✅ |
| UART RX | Arduino D2 | None | SoftwareSerial RX — **not coded yet** |
| UART TX | Arduino D3 | None | SoftwareSerial TX — **5V; level shift needed** |
| ESP32 TX2 | GPIO17 | None | ✅ Hardware UART2 |
| ESP32 RX2 | GPIO16 | None | **Do not wire until level shifter confirmed** |

### Original GPIO Conflict (from NAVIC-TRACK.md, now resolved in assignment)
The original draft conflicted GPIO 21/22 (I2C SDA/SCL) with the yaw ULN2003. The current firmware does not assign any pins to I2C, so the conflict is dormant. If MPU-6050 is added to the Arduino, use A4/A5. If MPU-6050 is added to ESP32, use GPIO21/22 — but keep these free from motor driver lines.

### Limit Switch Pins — NOT ASSIGNED
Limit switch GPIO must be assigned to the Arduino Uno (not ESP32) since the Arduino controls the motors and must be able to react in hardware interrupt time:
- **Suggested:** Az home: D12, El min: A0, El max: A1, Az max: A2 — to be confirmed before coding.

---

## 9. Motor Calibration Uncertainties

### 9.1 Steps per degree — computed, not measured
The firmware uses:
- Azimuth: 40.25 steps/deg (implies external gear ratio ~3.555:1, unverified from CAD)
- Elevation: 40.43 steps/deg (50T/14T = 3.571:1, internally consistent)

The 28BYJ-48 internal gearbox is specified as 63.68395:1 (not exactly 64:1). Common half-step count per output shaft revolution is **4075.7728**, not 4096.

**Verification formula:**
```
steps_per_deg = 4075.7728 × (driven_teeth / drive_teeth) / 360
Elevation: 4075.7728 × (50/14) / 360 = 40.44 ✓ (firmware uses 40.43 — close)
Azimuth:   4075.7728 × (ring_teeth / pinion_teeth) / 360 = ? (ring gear tooth count UNVERIFIED)
```

The azimuth gear ratio from the Stratos CAD must be measured or confirmed. The 40.25 value is a placeholder. **Do not trust axis calibration until a physical angle measurement is made.** Use the Settings page calibration fields to update this after mechanical assembly.

### 9.2 Backlash
Backlash compensation (0.5°) is defined in config but not implemented in the Arduino firmware. The always-approach-from-same-direction algorithm must be coded and verified with the actual mechanical assembly.

### 9.3 Direction polarity
Motor direction (which direction of step sequence corresponds to CW antenna rotation) is not documented and must be determined during bench testing. `IN1→IN4` step direction may need inversion per axis depending on ULN2003 wiring orientation.

---

## 10. TLE Data Issues

### 10.1 Fallback TLEs for NOAA 15, 18, 19 — INVALID CHECKSUMS
**File:** `mock-server/src/tle-data.ts` and `web/src/lib/server/tle-data.ts`

NOAA 15, 18, and 19 fallback TLEs fail checksum validation:
- NOAA 18 L1: expected `9`, got `1`
- NOAA 18 L2: expected `0`, got `2`
- NOAA 15 L1/L2: fail
- NOAA 19 L1/L2: fail

These appear to be manually constructed placeholder TLEs with `.15000000` day-of-year values (not real ephemerides). They will produce incorrect orbital positions.

**Fix:** Remove all manually constructed fallback TLEs. Keep only TLEs whose checksums are verified correct (METEOR-M2 4, IRNSS-1A/1B, ISS). For all other satellites, require a successful CelesTrak fetch before they appear in the catalog.

### 10.2 No TLE age enforcement
The `updatedAt` timestamp is stored but nothing blocks tracking when TLEs are more than N days old. For LEO satellites (METEOR, NOAA, ISS), TLEs older than 3–5 days produce significant position errors. A configurable maximum TLE age policy must be implemented.

### 10.3 `source` field inconsistency
The `TleData` type defines `source` as `'CELESTRAK' | 'ISRO' | 'MANUAL'`, but `web/src/lib/server/tle-data.ts` returns satellites with `group: 'CUSTOM'` when fetched live. The `SatelliteInfo.group` type is a separate field from `TleData.source` — these are not in conflict, but the `'CUSTOM'` group value is used inconsistently.

### 10.4 `tle/refresh` endpoint inconsistency
The Next.js API route's `tle/refresh` handler mutates `currentTle` directly:
```typescript
currentTle.line1 = liveSat.tle.line1;
```
This works because `currentTle` is a module-level mutable object, but Next.js serverless functions may run in different worker instances and each has its own state copy. This state is not shared between requests in a deployed serverless environment. Only relevant for local dev; still a correctness concern.

---

## 11. Security Findings

### 11.1 Hardcoded auth token in ESP32 firmware (MEDIUM)
`"navic-secret-token-123"` is both the default mock-server token and the hardcoded ESP32 token. Any attacker who reads the public GitHub repository would know the token. Must be changed before field deployment.

### 11.2 No HTTPS on ESP32 HTTP server (ACCEPTED for local use)
The ESP32 WebServer library does not support TLS. For local LAN use this is acceptable. Document clearly that the ESP32 must not be exposed to the internet.

### 11.3 No CORS restriction on mock server (LOW)
`app.use(cors())` allows all origins. For a local development tool this is acceptable but should be restricted in any deployed configuration.

### 11.4 Gemini API key — no .env.local in web/ (INFO)
`web/.env.local` does not exist. The Gemini API key is not set. Jarvis AI replies fall back to deterministic responses. The key must never be committed to git.

### 11.5 Wi-Fi credentials in .ino source (HIGH for firmware)
See Bug 7.8. Wi-Fi SSID and password are plaintext in the .ino file. This file must not be committed to any public repository with real credentials.

---

## 12. State Machine Gaps

### Required states (from master spec) vs implemented states

| State | In shared/types | Mock server | Arduino | ESP32 |
|-------|----------------|-------------|---------|-------|
| IDLE | ✅ | ✅ | Implicit | ✅ |
| HOMING | ✅ | ✅ (fake) | ❌ (zeros only) | ❌ |
| READY | ❌ | ❌ | ❌ | ❌ |
| ACQUIRING | ❌ | ❌ | ❌ | ❌ |
| TRACKING | ✅ | ✅ | ❌ (no such concept) | ✅ |
| PAUSED | ❌ | ❌ | ❌ | ❌ |
| SLEWING | ✅ (extra) | ✅ | ❌ | ❌ |
| STOPPING | ❌ | ❌ | ❌ | ❌ |
| ERROR | ✅ | ❌ (never set) | ❌ | ❌ |
| EMERGENCY_STOP | ❌ | ❌ | ❌ | ❌ |
| PARKED | ✅ (extra) | ❌ (never set) | ❌ | ❌ |

The `ERROR` state is defined in types but never set by any code path. No error condition in the mock server or firmware transitions to `ERROR`. The system appears to always be in a healthy state.

---

## 13. Duplicate Code Paths

There are **two independent implementations** of the orbit engine, TLE fetcher, and state machine:

| Component | Location 1 | Location 2 |
|-----------|-----------|-----------|
| SGP4 propagation | `mock-server/src/simulator.ts` | `web/src/lib/server/simulator.ts` |
| TLE fetch/cache | `mock-server/src/tle-data.ts` | `web/src/lib/server/tle-data.ts` |
| Tracker state | `mock-server/src/state.ts` | `web/src/lib/server/state.ts` |
| Type definitions | `shared/types/tracker.ts` | `web/src/types/tracker.ts` |

The `web/src/lib/server/` modules are used by the Next.js catch-all API route (`/api/v1/[...slug]/route.ts`). This path is a **fallback for serverless/Vercel deployment** where the mock server is not running. It has fewer features, less validation, and contains the `hardwareConnected: true` lie.

**Decision required:** For local hardware development, the mock server (port 8080) is the primary backend. The Next.js internal API route should be deprecated or clearly marked as the serverless-only fallback. All hardware integration must go through the mock server path, which will evolve into the real backend in later phases.

---

## 14. Implementation Plan — Phases 2–9

### Phase 2 — Real Orbit Engine (Python/FastAPI) — NEXT
**Goal:** Replace Node.js SGP4 with a dedicated Python service using `skyfield` or `sgp4` library.  
**Files to create:**
```
orbit-engine/
├── requirements.txt
├── main.py              ← FastAPI app
├── tle_manager.py       ← Fetch, validate, cache TLEs from CelesTrak
├── sgp4_engine.py       ← Position calculation, Az/El, range, range-rate
├── pass_predictor.py    ← AOS/LOS/TCA/max elevation
└── tests/
    ├── test_tle.py
    ├── test_sgp4.py
    └── test_pass_predictor.py
```
**Runs on:** `http://localhost:8200`  
**Integration:** mock-server `simulator.ts` calls orbit-engine API instead of doing its own SGP4. This centralises the orbit calculation in one place.  
**TLE fix:** Remove all invalid NOAA fallback TLEs.

### Phase 3 — Arduino Firmware Rewrite
**Goal:** Fix all critical bugs, add SoftwareSerial, correct speed, add homing, add limit switches.  
**Files to create/replace:**
```
firmware/arduino_uno/
├── navic_track_arduino.ino   ← Main firmware (replaces arduino_rotator.ino)
├── config.h                  ← Calibration constants
└── README.md                 ← Wiring and upload instructions
```
**Key changes:**
1. Add `SoftwareSerial mySerial(2, 3)` — receive commands on D2
2. Change baud rate to 9600
3. Fix `STEP_INTERVAL_MICROS` to 6211µs (azimuth) / 7069µs (elevation)
4. Implement real homing with limit switch interrupts
5. Add acceleration/deceleration ramp
6. Add communication watchdog (60s timeout → STOP)
7. Add emergency stop command
8. Keep existing pin assignments (D4–D11)

### Phase 4 — ESP32 Firmware Rewrite
**Goal:** Fix UART, baud rate, timeout, non-blocking serial, secure config.  
**Files to create/replace:**
```
firmware/esp32/
├── navic_track_esp32.ino   ← Main firmware (replaces esp32_bridge.ino)
├── config.h                ← WiFi SSID/pass in separate gitignored file
└── README.md
```
**Key changes:**
1. Change UART2 baud to 9600 (must match Arduino)
2. Non-blocking character-by-character serial read with 128-byte buffer
3. Proper command acknowledgement state machine
4. Acknowledge timeout with error reporting
5. `hardware_mode` field in all status responses
6. Move Wi-Fi credentials to `config.h` (gitignored)

### Phase 5 — Hardware Integration
**Sequence:**
1. Flash corrected Arduino firmware; verify via USB Serial Monitor
2. Flash corrected ESP32 firmware; verify Wi-Fi connection
3. Connect ESP32 GPIO17 → Arduino D2 (one-way, confirmed safe)
4. Test `GOTO,45.0,20.0` command end-to-end: dashboard → mock server → ESP32 → Arduino → motor moves
5. Verify motor direction and step count per degree
6. Connect both motors and verify independence
7. Connect limit switches (after wiring is verified)
8. Test full homing sequence

### Phase 6 — Automatic Tracking Integration
**Goal:** Live SGP4 → target angles → motor commands at configurable rate.  
Tracking controller in mock-server: replace simulated physics with real hardware commands forwarded to ESP32.

### Phase 7 — Dashboard Hardware Mode
**Goal:** Dashboard clearly shows `SIMULATION` / `MOCK` / `HARDWARE_CONNECTED` / `HARDWARE_ERROR`.  
Add `hardware_mode` field to all API responses. Update all dashboard cards to display mode.

### Phase 8 — Jarvis Integration
Requires OpenJarvis service running and Gemini API key set. Currently offline — no code changes needed until Phase 7 is complete.

### Phase 9 — Final Validation
Automated tests, full satellite pass tracking test, documentation.

---

## 15. File-by-File Status Summary

| File | Status | Action Required |
|------|--------|----------------|
| `firmware/esp32_bridge/esp32_bridge.ino` | ⚠️ Has critical bugs | Rewrite in Phase 4 |
| `firmware/arduino_rotator/arduino_rotator.ino` | ❌ Has critical bugs | Rewrite in Phase 3 |
| `mock-server/src/index.ts` | ✅ Working | Add hardware_mode field |
| `mock-server/src/state.ts` | ⚠️ Fake motors | Replace physics with hardware bridge in Phase 6 |
| `mock-server/src/simulator.ts` | ✅ Real SGP4 | Redirect to orbit-engine in Phase 2 |
| `mock-server/src/tle-data.ts` | ⚠️ Invalid NOAA TLEs | Fix checksum failures |
| `mock-server/src/auth.ts` | ✅ Working | No change |
| `mock-server/src/jarvis/` | ✅ Working (offline) | No change until Phase 8 |
| `web/src/app/` (all 6 pages) | ✅ Working | Add hardware_mode display |
| `web/src/context/TrackerContext.tsx` | ✅ Working | No change |
| `web/src/lib/api.ts` | ✅ Working | No change |
| `web/src/lib/server/state.ts` | ❌ Lies about hardware | Mark as serverless-fallback, fix hardwareConnected |
| `web/src/lib/server/tle-data.ts` | ⚠️ Invalid NOAA TLEs | Fix checksum failures |
| `web/src/app/api/v1/[...slug]/route.ts` | ⚠️ Serverless fallback | Label clearly, fix hardware_mode |
| `shared/types/tracker.ts` | ⚠️ Missing states | Add EMERGENCY_STOP, ACQUIRING, PAUSED, STOPPING |
| `openjarvis-service/server.py` | ✅ Working (offline) | No change until Phase 8 |
| `orbit-engine/` | ❌ Does not exist | Create in Phase 2 |
| `tests/` | ❌ Does not exist | Create in Phase 2+ |
| `docs/API.md` | ✅ Accurate | Update with hardware_mode field |
| `web/.env.local` | ❌ Does not exist | Create for real hardware use |

---

## Summary

The project has a solid, well-structured web dashboard and mock server with real SGP4 orbital math. The six dashboard pages are functional and visually complete.

**The primary gaps between the current state and a real tracking system are:**

1. **The Arduino firmware does not receive commands from the ESP32** (wrong serial port, missing SoftwareSerial).
2. **The Arduino motor speed is 2.3× too fast**, causing stall.
3. **Homing is a counter reset**, not a physical endstop seek.
4. **No physical hardware status is ever read** — `hardwareConnected: true` is a lie.
5. **Three NOAA fallback TLEs have invalid checksums** and must be removed.
6. **No Python orbit engine exists** yet.
7. **No automated tests exist** yet.

Fixing bugs 1 and 2 alone will make the motors respond to commands. Everything else is an enhancement on top of that foundation.

**Proceed to Phase 2: Python Orbit Engine.**
