/*
 * NAVIC-TRACK Arduino Uno Configuration
 * 
 * Edit the CALIBRATION SECTION after physical measurement.
 * All other sections (pin assignments, safety limits) match the
 * hardware specification and must not be changed without rewiring.
 */

#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// PIN ASSIGNMENTS — match physical wiring, do not change without rewiring
// ============================================================================

// Azimuth ULN2003
#define PIN_AZ_IN1  8
#define PIN_AZ_IN2  9
#define PIN_AZ_IN3  10
#define PIN_AZ_IN4  11

// Elevation ULN2003
#define PIN_EL_IN1  4
#define PIN_EL_IN2  5
#define PIN_EL_IN3  6
#define PIN_EL_IN4  7

// SoftwareSerial (ESP32 bridge)
// RX = D2: receives from ESP32 GPIO17 TX2 (3.3V → 5V is acceptable on AVR)
// TX = D3: DO NOT connect to ESP32 until a level shifter is verified
#define PIN_SW_RX   2
#define PIN_SW_TX   3

// Limit switches (INPUT_PULLUP, LOW = triggered)
// Adjust assignments if your wiring differs — verify before running HOME
#define PIN_LIMIT_AZ_HOME   12   // Azimuth home / zero reference
#define PIN_LIMIT_EL_MIN    A0   // Elevation 0° (minimum)
#define PIN_LIMIT_EL_MAX    A1   // Elevation 90° (maximum, safety stop)

// ============================================================================
// PHYSICAL ANGLE LIMITS
// ============================================================================

#define AZ_MIN_DEG   0.0f
#define AZ_MAX_DEG   360.0f
#define EL_MIN_DEG   0.0f
#define EL_MAX_DEG   90.0f

// ============================================================================
// CALIBRATION SECTION
// Update these values after physical measurement.
//
// Formula:
//   steps_per_deg = 4075.7728 * (driven_teeth / drive_teeth) / 360.0
//
// Elevation (50T/14T = 3.5714:1):
//   4075.7728 * (50.0 / 14.0) / 360.0 = 40.44 half-steps/deg
//
// Azimuth gear ratio: VERIFY FROM CAD or physical measurement.
//   Current value (40.25) implies ratio ≈ 3.555:1 — UNVERIFIED.
//   Do not trust tracking accuracy until this is physically confirmed.
// ============================================================================

#define STEPS_PER_DEG_AZ  40.25f   // ← UNVERIFIED: measure and update
#define STEPS_PER_DEG_EL  40.44f

// ============================================================================
// MOTOR SPEED
// Step interval in microseconds between consecutive half-steps.
//
// At STEPS_PER_DEG_AZ = 40.25:
//   interval = 1,000,000 / (target_deg_per_sec * steps_per_deg)
//   For 4.0 deg/s:  1,000,000 / (4.0 * 40.25) = 6,211 us
//   For 3.5 deg/s:  1,000,000 / (3.5 * 40.44) = 7,069 us
//
// 28BYJ-48 max reliable speed (unloaded): ~600 half-steps/sec ≈ 15 deg/s
// With mechanical load and printed gears, recommended max ≤5 deg/s.
// ============================================================================

#define STEP_INTERVAL_MICROS_AZ   6211UL   // ≈ 4.0 deg/s
#define STEP_INTERVAL_MICROS_EL   7069UL   // ≈ 3.5 deg/s

// ============================================================================
// HOMING
// ============================================================================

// Back-off distance after hitting a limit switch (degrees)
#define HOMING_BACKOFF_DEG   2.0f

// Maximum time for a full homing sequence before declaring failure
#define HOMING_TIMEOUT_MS    60000UL    // 60 seconds

// ============================================================================
// WATCHDOG
// If no PING is received for this duration and motors are running, stop.
// ============================================================================

#define WATCHDOG_MS   30000UL    // 30 seconds

// ============================================================================
// SERIAL
// ============================================================================

#define SERIAL_BUF_SIZE   96    // Characters in command input buffer

#endif // CONFIG_H
