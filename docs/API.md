# NAVIC-TRACK API Specification (v1)

This document specifies the REST and WebSocket API contract implemented by the NAVIC-TRACK tracker. Both the ESP32 firmware and the mock server adhere strictly to this specification.

All REST endpoints are versioned under `/api/v1/`.

---

## 1. Protocol & Transport Overview

- **Base REST URL**: `http://<tracker-ip>:8080/api/v1` (or port 80 on native ESP32)
- **WebSocket URL**: `ws://<tracker-ip>:8080/ws`
- **Data Format**: JSON (`application/json; charset=utf-8`)
- **Authentication**: Token-based via HTTP Header:
  ```http
  Authorization: Bearer <TOKEN>
  ```
  Or header:
  ```http
  X-API-Key: <TOKEN>
  ```
- **Security & Rate Limiting**:
  - Control endpoints (move, home, track, config, time, tle update) strictly require valid tokens.
  - Rate limiting is enforced on failed authentication attempts: 5 failed attempts from an IP address triggers a 30-second cooldown (`429 Too Many Requests`).
  - Motor slewing speed commands are clamped at $< 5.0^\circ/\text{s}$ to prevent 28BYJ-48 stepper stall.
  - Angular bounds: Azimuth $0.0^\circ$ to $360.0^\circ$, Elevation $0.0^\circ$ to $90.0^\circ$.

---

## 2. Standard Response Wrapper

All REST endpoints return an envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-11-13T07:15:00.000Z"
}
```

On failure:

```json
{
  "success": false,
  "error": "Error description message",
  "timestamp": "2026-11-13T07:15:00.000Z"
}
```

---

## 3. Endpoints

### 3.1 `GET /api/v1/status`
Returns live system state, motor angles, satellite tracking info, IMU attitude, and time synchronization state.
- **Auth**: None (Public telemetry read)
- **Response `data`**:
```json
{
  "state": "TRACKING",
  "homed": true,
  "currentAngles": {
    "azimuth": 128.45,
    "elevation": 42.10
  },
  "targetAngles": {
    "azimuth": 128.50,
    "elevation": 42.15
  },
  "satelliteName": "NavIC-1B",
  "noradId": 39635,
  "imu": {
    "pitch": 0.12,
    "roll": -0.05,
    "isLevel": true
  },
  "timeSync": "SYNCED",
  "lastTimeSync": "2026-11-13T07:00:00.000Z",
  "uptimeSeconds": 3412,
  "lastError": null,
  "firmwareVersion": "1.0.0-esp32"
}
```

---

### 3.2 `GET /api/v1/config`
Retrieve current observer coordinates, motor steps/degree, speed limits, and calibration offsets.
- **Auth**: None
- **Response `data`**:
```json
{
  "observer": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "altitudeMeters": 216.0
  },
  "motion": {
    "maxAzimuthSpeedDegS": 4.5,
    "maxElevationSpeedDegS": 4.5,
    "azimuthStepsPerDegree": 40.25,
    "elevationStepsPerDegree": 40.42,
    "azimuthOffsetDeg": 0.0,
    "elevationOffsetDeg": 0.0,
    "backlashCompensationDeg": 0.75
  }
}
```

---

### 3.3 `POST /api/v1/config`
Update observer coordinates, mechanical calibration, or speed parameters.
- **Auth**: Required (`Bearer <token>`)
- **Request Body**: Partial or full `TrackerConfig` object.
- **Validation**:
  - `latitude`: $[-90, +90]$
  - `longitude`: $[-180, +180]$
  - `maxAzimuthSpeedDegS`, `maxElevationSpeedDegS`: $(0, 5.0]$
- **Response**: Updated `TrackerConfig`.

---

### 3.4 `POST /api/v1/satellite`
Select active target satellite by name or NORAD catalog ID. If `autoTrack` is true, immediately engages tracking.
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "name": "NavIC-1B",
  "noradId": 39635,
  "autoTrack": true
}
```
- **Response**: Confirmed satellite details and computed initial target angles.

---

### 3.5 `GET /api/v1/tle`
Retrieve active Two-Line Element set stored in tracker memory/flash.
- **Auth**: None
- **Response `data`**:
```json
{
  "satelliteName": "NavIC-1B",
  "noradId": 39635,
  "line1": "1 39635U 14017A   26315.42100000 -.00000100  00000-0  00000-0 0  9993",
  "line2": "2 39635  29.5000 130.0000 0012000  75.0000 285.0000  1.00270000 45001",
  "updatedAt": "2026-11-13T06:30:00.000Z",
  "source": "CELESTRAK"
}
```

---

### 3.6 `POST /api/v1/tle`
Upload new TLE data to the tracker.
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "satelliteName": "IRNSS-1B",
  "line1": "1 39635U 14017A   26315.42100000 -.00000100  00000-0  00000-0 0  9993",
  "line2": "2 39635  29.5000 130.0000 0012000  75.0000 285.0000  1.00270000 45001"
}
```

---

### 3.7 `POST /api/v1/track`
Start, stop, or pause automated satellite tracking.
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "action": "START"
}
```
*(Valid actions: `"START"`, `"STOP"`, `"PAUSE"`)*

---

### 3.8 `POST /api/v1/move`
Manually command mount to specified coordinates (Jog / Manual Move).
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "azimuth": 180.0,
  "elevation": 45.0,
  "speedDegS": 3.0
}
```
- **Validation**:
  - `azimuth`: $[0.0, 360.0]$
  - `elevation`: $[0.0, 90.0]$
  - `speedDegS` (optional): $\le 5.0^\circ/\text{s}$

---

### 3.9 `POST /api/v1/home`
Initiates homing calibration sequence against limit switches.
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "axis": "ALL"
}
```
*(Valid axis values: `"ALL"`, `"AZIMUTH"`, `"ELEVATION"`)*

---

### 3.10 `POST /api/v1/time`
Sync tracker internal clock via NTP or manual time injection (critical when ESP32 has no RTC or internet access).
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "action": "NTP_SYNC"
}
```
Or manual time injection:
```json
{
  "action": "MANUAL",
  "timestamp": "2026-11-13T07:15:30.000Z"
}
```
- **Response `data`**:
```json
{
  "timeSync": "SYNCED",
  "currentTrackerTime": "2026-11-13T07:15:30.000Z",
  "driftMs": 12,
  "message": "Tracker time synchronized successfully"
}
```

---

### 3.11 `GET /api/v1/logs`
Fetches in-memory ring-buffer history of commanded vs actual angles.
- **Auth**: None
- **Query Parameters**:
  - `limit`: Integer (default 50, max 200)
  - `since`: ISO timestamp string filter
- **Response `data`**: Array of `TelemetryLogEntry` items.
```json
[
  {
    "id": "log-1024",
    "timestamp": "2026-11-13T07:14:58.000Z",
    "commandedAzimuth": 128.50,
    "actualAzimuth": 128.45,
    "commandedElevation": 42.15,
    "actualElevation": 42.10,
    "trackingErrorDeg": 0.07,
    "state": "TRACKING"
  }
]
```
*(Note for ESP32 firmware: History is kept in a lightweight circular RAM buffer of up to 100-200 points. The web app caches historical points long-term in browser IndexedDB).*

---

## 4. WebSocket Telemetry Stream (`/ws`)

- **Frequency**: 1 to 2 Hz (rate-limited for ESP32 radio & processing budget).
- **Payload Constraint**: Strictly kept under **300 bytes** serialized.

### Lean Telemetry Frame Format:
```json
{
  "t": 1794557400000,
  "st": "TRACKING",
  "hm": 1,
  "c": [128.45, 42.10],
  "tg": [128.50, 42.15],
  "err": 0.07,
  "imu": [0.12, -0.05, 1],
  "sat": "NavIC-1B",
  "rssi": -58
}
```

### Key Mapping Reference:
| Key | Type | Description |
|---|---|---|
| `t` | Number | Unix epoch millisecond timestamp |
| `st` | String | State (`"IDLE"`, `"TRACKING"`, `"SLEWING"`, `"HOMING"`, `"ERROR"`) |
| `hm` | 0 \| 1 | Homed flag (1 = true, 0 = false) |
| `c` | [num, num] | Current angles: `[azimuth, elevation]` in degrees |
| `tg` | [num, num] | Target commanded angles: `[azimuth, elevation]` in degrees |
| `err`| Number | Angular pointing error in degrees |
| `imu`| [num, num, 0\|1] | `[pitch, roll, isLevel]` from MPU-6050 |
| `sat`| String | Short name of satellite currently being tracked |
| `rssi`| Number | Wi-Fi RSSI in dBm |

---

## 5. Error Codes & HTTP Statuses

| Status | Code | Meaning |
|---|---|---|
| `200 OK` | - | Operation succeeded |
| `400 Bad Request` | `INVALID_PAYLOAD` | Angles out of bounds ($Az \notin [0,360]$, $El \notin [0,90]$), or invalid JSON |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing or invalid Bearer token |
| `429 Too Many Requests` | `RATE_LIMITED` | Too many failed authentication attempts; cool down for 30s |
| `503 Service Unavailable` | `NOT_HOMED` | Motion commanded while un-homed or emergency limit switch triggered |

