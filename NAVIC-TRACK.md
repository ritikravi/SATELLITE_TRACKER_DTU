# NAVIC-TRACK: Autonomous 2-Axis Satellite Antenna Tracker

> Context file for AI coding agents (e.g. Antigravity). Read this fully before writing code. It describes the hardware, firmware architecture, testing plan, risks, and the planned website-to-software integration.

## 0. How to use this file

- This is the single source of truth for the NAVIC-TRACK project.
- Sections marked **[VERIFY]** contain numbers or pin assignments that must be checked before being relied on.
- Section 10 (Website Integration) is the next major goal: the website must talk to the tracker software.
- Do not substitute heavier hardware (NEMA23, servos). The design constraint is low-cost 28BYJ-48 steppers plus gear reduction.

## 1. Project summary

NAVIC-TRACK is an ESP32-based dual-axis (azimuth/elevation) antenna mount that autonomously tracks satellites (NavIC/IRNSS and others) using TLE data and the SGP4 propagator.

- Estimated cost: about INR 1,200-1,300
- Target pointing accuracy: a few degrees (enough for broad-beam patch antennas)
- Target payload: under 0.5 kg antenna, about 0.2 m from the rotation axis
- Slow slewing only (under 5 deg/s)

## 2. Hardware

| Part | Qty | Notes |
|---|---|---|
| ESP32-WROOM-32 DevKit | 1 | Dual-core 240 MHz, Wi-Fi/BT, 3.3 V logic |
| 28BYJ-48 stepper (5 V, unipolar) | 2 | About 2038 full steps/rev (about 4076 half-steps) via internal ~1:63.684 gearbox |
| ULN2003 driver module | 2 | Darlington array, about 1.5-2 V drop, coils see about 3-3.5 V |
| 608ZZ bearing (8x22x7 mm) | 4 | 2 per axis |
| MPU-6050 (GY-521) | 1 | I2C, 3.3 V, used for leveling |
| Limit switches | about 4 | Homing and safety |
| 5 V 2 A supply | 1 | Powers steppers (about 500 mA per motor) |
| 3D-printed frame and gears | - | Based on the Stratos design, PLA, infill at least 50% |

### Mechanics

- Elevation gearset: 14-tooth pinion to 50-tooth gear (about 3.57:1), per Stratos V3.
- Azimuth: pinion plus ring gear, about 3-4:1 **[VERIFY from CAD]**.
- Expect backlash from printed gears; compensate in software (always approach target from the same direction).
- Range: azimuth 0-360 degrees, elevation 0-90 degrees.

### Torque (as stated in the original dossier)

- Design load example: 0.5 kg at 0.2 m, which gives about 0.098 N*m, or about 0.196 N*m with a 2x safety factor.
- **[VERIFY]** The original dossier claims 0.30-0.40 N*m usable output torque. Typical 28BYJ-48 datasheets list about 34 mN*m (0.034 N*m) at the output shaft of the built-in gearbox, so this claim is likely too high by roughly 10x. With the extra 3.57:1 printed gear stage, realistic output is nearer 0.1 N*m. Re-check the load budget and consider a lighter antenna, shorter lever arm, or counterbalance before building.

## 3. Wiring

```
USB 5V ──> ESP32 DevKit (onboard 3.3V reg) ──> MPU6050 (3.3V)
5V PSU ──> ULN2003 (x2) ──> 28BYJ-48 (x2)
All grounds common.

ESP32 GPIO ──> ULN2003 IN1-IN4 (pitch)
ESP32 GPIO ──> ULN2003 IN1-IN4 (yaw)
ESP32 SDA/SCL ──> MPU6050 (addr 0x68, AD0 low)
ESP32 GPIO (INPUT_PULLUP) ──> limit switches ──> GND
```

- **[VERIFY]** The original draft assigned GPIO 21/22 to both the yaw ULN2003 and I2C (SDA/SCL). That is a conflict. Suggested clean mapping:
  - Pitch ULN2003: GPIO 16, 17, 18, 19
  - Yaw ULN2003: GPIO 25, 26, 27, 14
  - I2C: SDA = GPIO 21, SCL = GPIO 22
  - Limit switches: GPIO 32 (az home), 33 (el min), 34/35 are input-only with no internal pull-up, so avoid them for switches without external resistors
- Power the steppers from the external 5 V supply, not from the ESP32 board, to avoid brownouts.
- ULN2003 COM pin to +5 V.

## 4. Firmware architecture

Framework: Arduino core for ESP32 (or ESP-IDF).

Modules:

1. **Time**: NTP over Wi-Fi at boot and periodically. Fallback is manual entry (no RTC fitted).
2. **TLE manager**: fetch from Celestrak/ISRO, store in SPIFFS/LittleFS, refresh periodically.
3. **SGP4**: Sgp4 library (HopperPop/SparkFun port). Output ECI position, convert to topocentric azimuth/elevation for the configured observer latitude/longitude.
4. **Motion control**: AccelStepper or custom half-step sequencer. Steps per degree is calibrated from the gear ratio:
   - elevation: 4076 half-steps/rev x (50/14) / 360
   - azimuth: 4076 x azimuth ratio / 360
5. **Homing**: drive to endstops at boot and zero counters.
6. **IMU**: MPU-6050 used statically at startup for level check; optional complementary filter. No closed-loop stabilization.
7. **Config/UI**: web server on the ESP32 for status and configuration (see Section 10).

Safety rules in code:
- Clamp elevation to 0-90 degrees and azimuth to 0-360 degrees.
- Limit max speed and acceleration to avoid missed steps.
- Disable coil outputs when idle to reduce heat.
- Stop on any endstop trigger outside homing.

## 5. Validation and testing

1. Unit: verify stepping sequence and step-to-angle mapping; measure ULN2003 voltage drop; check MPU-6050 rest bias.
2. Software: compare SGP4 az/el against an online predictor (ISS or a test satellite) at multiple times.
3. Integration: home both axes, command fixed angles, verify with a protractor or mechanical stops.
4. Field: track a real NavIC/other pass, check with a compass and clinometer, log commanded vs actual.
5. Calibration: refine steps/degree, tune speed and acceleration.
6. Thermal: if ULN2003 or motors exceed about 60 C, reduce duty cycle or improve ventilation.

## 6. Bill of materials (INR)

| Item | Total |
|---|---|
| ESP32 DevKit | about 400 |
| 28BYJ-48 x2 | about 200 |
| ULN2003 x2 | about 90 |
| 608ZZ x4 | about 135 |
| MPU-6050 | about 141 |
| USB cable and 5 V supply | about 100 |
| Limit switches | about 40 |
| Wires/connectors | about 50 |
| PLA filament | about 100 |
| Screws/bolts | about 50 |
| **Total** | **about 1,216** |

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Stepper torque too low / stall | Light antenna, short lever arm, slow motion, safety factor; verify torque numbers (see Section 2) |
| ULN2003 voltage drop and heat | Ventilation; consider MOSFET/better drivers later |
| Backlash in printed gears | Software one-direction approach; tight print tolerances |
| IMU drift | Use only for static leveling at startup |
| Wrong time or stale TLE | NTP sync, regular TLE refresh, optional RTC |
| SGP4/coordinate bugs | Use tested library; compare against known predictions; sanity checks |
| Wind and vibration loosening parts | High infill, secure hardware, strong mount |

## 8. Roadmap (2026)

1. M3: finalize design, print parts, dry fit
2. M4-5: electronics assembly, jog and sensor tests
3. M6-7: firmware (SGP4, homing, control)
4. M8-9: bench tracking tests, tuning
5. M10-11: field tests with a small NavIC antenna
6. M12: documentation and release

Future: NEMA17 with microstepping, axis encoders, magnetometer for azimuth, weatherproofing, multi-satellite scheduling, onboard display.

## 9. Open questions for the agent to resolve

- Confirm azimuth gear ratio from the Stratos CAD.
- Fix the GPIO mapping conflict (Section 3).
- Re-derive the torque budget from datasheets (Section 2).
- Decide the preferred SGP4 library and pin its version.

## 10. Website integration (planned, next phase)

Goal: our website connects to the tracker software so users can monitor and control the tracker remotely.

The details below are a proposed starting design, not yet decided. Treat them as a draft to refine with the team.

### Proposed architecture

```
Browser (website)  <──HTTPS/WebSocket──>  Backend (optional cloud relay)  <──>  ESP32 (REST + WebSocket)
```

- Simplest option: the website talks directly to the ESP32 on the local network.
- Remote option: ESP32 connects out to a backend/relay (MQTT or WebSocket) so the website works without port forwarding.

### Proposed ESP32 API (JSON)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/status` | GET | Current az/el, target az/el, satellite name, tracking state, homed flag, IMU tilt, time sync state, uptime |
| `/api/config` | GET/POST | Observer latitude/longitude/altitude, speed limits, steps/degree, calibration offsets |
| `/api/satellite` | POST | Select target satellite (name or NORAD ID) |
| `/api/tle` | GET/POST | Read current TLE, upload new TLE, trigger refresh |
| `/api/track` | POST | Start/stop tracking |
| `/api/move` | POST | Manual move to az/el (with limit checks) |
| `/api/home` | POST | Run homing routine |
| `/ws` | WebSocket | Live telemetry stream (az/el, errors, state) |

### Website features to support

- Live dashboard: current vs target az/el, satellite pass prediction, tracking status
- Satellite picker and TLE update
- Manual jog controls and homing button
- Calibration and configuration page
- Logs of commanded vs actual angles

### Requirements and cautions

- Authentication on all control endpoints (at least a token); never expose an unauthenticated motor-control API to the internet.
- Server-side validation of all angles and speeds; firmware must still enforce its own limits.
- Keep the ESP32 payloads small (JSON under a few KB) and rate-limit telemetry.
- CORS configuration if the website is served from a different origin.
- Versioned API (`/api/v1/...`) so the website and firmware can evolve separately.

## 11. Sources

Component specs from datasheets for the ESP32, 28BYJ-48, ULN2003, MPU-6050, and 608ZZ bearing. Orbital propagation via the SparkFun/HopperPop SGP4 library. Mechanical design based on Stratos. Prices from Indian distributors (e.g. Robocraze).
