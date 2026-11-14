# NAVIC-TRACK — Hardware Wiring Guide

## Overview

Three distinct power domains:
- 5V/2A external supply → ULN2003 COM pins and 28BYJ-48 motors
- Arduino Uno 5V regulated rail → Arduino logic, limit switches
- ESP32 USB 5V → ESP32 logic (3.3V internally)

**All grounds must be connected to a common ground point.**

---

## 1. Stepper Motors to ULN2003 Drivers

Each 28BYJ-48 motor plugs directly into its ULN2003 board via the 5-pin JST connector. No individual wire connections needed here.

### Power to ULN2003 Boards

| ULN2003 Pin | Connect to |
|-------------|-----------|
| `+` (VCC)   | External 5V supply positive |
| `-` (GND)   | Common ground |

---

## 2. ULN2003 to Arduino Uno

### Azimuth Motor (ULN2003 board 1)

| ULN2003 Input | Arduino Pin |
|---------------|-------------|
| IN1           | D8          |
| IN2           | D9          |
| IN3           | D10         |
| IN4           | D11         |

### Elevation Motor (ULN2003 board 2)

| ULN2003 Input | Arduino Pin |
|---------------|-------------|
| IN1           | D4          |
| IN2           | D5          |
| IN3           | D6          |
| IN4           | D7          |

---

## 3. ESP32 to Arduino UART (Phase 1 — One-Way)

**Phase 1 is transmit-only from ESP32 to Arduino.** The return path (Arduino D3 → ESP32 GPIO16) requires a 5V-to-3.3V level shifter and must NOT be connected until one is verified in place.

| ESP32 Pin       | Arduino Pin | Wire | Safety Note |
|-----------------|-------------|------|-------------|
| GPIO17 (TX2)    | D2          | Direct — SAFE (3.3V output into 5V AVR input is acceptable) | ✅ |
| GPIO16 (RX2)    | D3          | **DO NOT CONNECT** until level shifter is in place | ⚠️ |
| GND             | GND         | Direct — required | ✅ |

### Level Shifter (required before Phase 2 bidirectional)

Option A — Resistor voltage divider (minimum viable, marginal):
```
Arduino D3 TX (5V) ──┬── 10kΩ ──┬── ESP32 GPIO16 RX (3.3V)
                     │          │
                   10kΩ       20kΩ
                     │          │
                    GND        GND
```
Output voltage = 5V × 20kΩ/(10kΩ+20kΩ) = 3.33V. Acceptable but marginal at 9600 baud.

Option B — TXS0101 or BSS138 N-FET level shifter (recommended):
- Connect HV side to 5V / Arduino D3
- Connect LV side to 3.3V / ESP32 GPIO16
- Proper bidirectional operation at any baud rate

---

## 4. Limit Switches

Wire each switch between the Arduino pin and GND. The firmware uses `INPUT_PULLUP` so the pin reads HIGH when the switch is open and LOW when triggered.

| Switch Purpose  | Arduino Pin | Wire (one side) | Wire (other side) |
|-----------------|-------------|-----------------|-------------------|
| Azimuth home    | D12         | D12             | GND               |
| Elevation min   | A0          | A0              | GND               |
| Elevation max   | A1          | A1              | GND               |

Mount each switch so it triggers when the axis reaches its mechanical zero/limit:
- Az home: triggered when azimuth is at the 0° reference position
- El min: triggered when elevation is at 0° (horizontal)
- El max: triggered when elevation reaches 90° (vertical) — safety stop only

**Verify switch operation with a multimeter before running HOME.**

---

## 5. MPU-6050 (Future — not yet implemented in firmware)

If connected to the Arduino Uno:

| MPU-6050 Pin | Arduino Pin | Note |
|--------------|-------------|------|
| VCC          | 3.3V        | Use Arduino 3.3V pin, NOT 5V |
| GND          | GND         | Common ground |
| SDA          | A4          | Hardware I2C |
| SCL          | A5          | Hardware I2C |
| AD0          | GND         | Sets I2C address to 0x68 |

**Do not power MPU-6050 from 5V — it is a 3.3V device.**

---

## 6. Power Supply Diagram

```
External 5V/2A PSU ──────── ULN2003 (Azimuth) VCC
                   │
                   └──────── ULN2003 (Elevation) VCC
                   │
                   └──────── Arduino Uno VIN (or 5V pin)

USB to PC/charger ─────────── ESP32 DevKit USB (logic power only)

COMMON GROUND:
  PSU GND ── Arduino GND ── ESP32 GND ── ULN2003 GND (both boards)
```

**Do not power the steppers from the Arduino 5V pin.** The steppers draw ~500mA each at peak; the Arduino 5V regulator cannot supply this.

---

## 7. Completed Wiring Checklist

Before powering on:
- [ ] All ULN2003 boards powered from external 5V supply
- [ ] All grounds connected to common ground point
- [ ] Motor JST connectors seated correctly in ULN2003 sockets
- [ ] Arduino D8–D11 → Azimuth ULN2003 IN1–IN4
- [ ] Arduino D4–D7 → Elevation ULN2003 IN1–IN4
- [ ] ESP32 GPIO17 → Arduino D2 (single wire)
- [ ] ESP32 GND → Arduino GND
- [ ] Arduino D3 NOT connected to ESP32 (Phase 1)
- [ ] Limit switches wired (D12, A0, A1 to GND)
- [ ] Continuity checked on all connections
- [ ] No short between 5V and 3.3V rails
