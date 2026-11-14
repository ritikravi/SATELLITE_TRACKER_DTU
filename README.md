# NAVIC-TRACK: Autonomous 2-Axis Satellite Antenna Tracker

Web dashboard and telemetry interface for the NAVIC-TRACK ESP32-based satellite antenna mount. Designed for tracking NavIC/IRNSS and LEO constellations using 28BYJ-48 stepper motors, MPU-6050 IMU, and SGP4 orbital propagation.

---

## 1. System Requirements & Environment

- **Node.js**: Tested with **Node v24.18.0** and npm **11.16.0** (compatible with Node `>=20.0.0`).
- **Engines constraint**: `"engines": { "node": ">=20.0.0" }`.

---

## 2. Quick Start

### Single-Command Start (Mock Server + Web Dashboard)
From the project root:

```bash
npm run dev
```

This starts:
1. **Mock ESP32 Tracker Server** on `http://localhost:8080` (WebSocket at `ws://localhost:8080/ws`)
2. **Next.js Web Dashboard** on `http://localhost:3000`

### Individual Service Commands
- **Mock Server only**:
  ```bash
  cd mock-server
  npm start
  ```
- **Web App only**:
  ```bash
  cd web
  npm run dev
  ```

---

## 3. Configuration & Environment Variables

### Root / Web App (`web/.env.local`)
Create `web/.env.local` (or copy from `web/.env.example`):

```bash
# REST API URL of tracker (mock server or real ESP32)
NEXT_PUBLIC_TRACKER_URL=http://localhost:8080

# WebSocket live telemetry URL
NEXT_PUBLIC_TRACKER_WS_URL=ws://localhost:8080/ws
```

### Mock Tracker Server (`mock-server/.env`)
Create `mock-server/.env` (or copy from `mock-server/.env.example`):

```bash
PORT=8080
# Secret token required on all motor control endpoints
TRACKER_AUTH_TOKEN=navic-secret-token-123
```

---

## 4. Connecting to a Real ESP32

To switch from the simulated mock server to a real ESP32 running NAVIC-TRACK firmware:
1. Connect your ESP32 to the local Wi-Fi network and note its IP address (e.g. `192.168.1.150`).
2. Update `web/.env.local`:
   ```env
   NEXT_PUBLIC_TRACKER_URL=http://192.168.1.150
   NEXT_PUBLIC_TRACKER_WS_URL=ws://192.168.1.150/ws
   ```
3. Restart Next.js (`npm run dev`).
4. In the web dashboard navbar, click **"SET TOKEN"** and enter the secret token configured in your ESP32 firmware preferences.

### Mixed-Content Browser Security Caveat
> [!IMPORTANT]
> Modern web browsers prohibit **Mixed Content**: if this web application is hosted on an **HTTPS** domain (e.g. Vercel, Netlify, or custom domain), the browser will **block** unencrypted HTTP (`http://192.168...`) and unencrypted WebSocket (`ws://192.168...`) requests to private local IPs.
> 
> **Recommended Solutions for Field Use:**
> 1. **Run Locally**: Run Next.js on your laptop or field computer over local HTTP (`http://localhost:3000` or `http://192.168.x.x:3000`).
> 2. **Remote Relay**: As outlined in NAVIC-TRACK.md Section 10, configure the ESP32 to connect outward to an MQTT broker or secure WebSocket relay (`wss://`), allowing cloud-hosted web apps to communicate without local network ingress issues.

---

## 5. Security Architecture

1. **Bearer Token Authentication**:
   All motor control and configuration endpoints (`/api/v1/move`, `/api/v1/home`, `/api/v1/track`, `/api/v1/config`, `/api/v1/tle`, `/api/v1/time`) strictly enforce `Authorization: Bearer <token>` or `X-API-Key: <token>`.
2. **Brute-Force Rate Limiting**:
   The mock server locks out client IPs for 30 seconds (`429 Too Many Requests`) after 5 failed authentication attempts within a 60-second window.
3. **Hardware Speed Clamping**:
   Motor commands are clamped to $\le 5.0^\circ/\text{s}$ to prevent 28BYJ-48 stepper stall and missed steps.
4. **Safety Confirmation Modals**:
   - The UI enforces a confirmation dialog before initiating **Homing**.
   - The UI enforces a confirmation dialog before executing any manual move with displacement $> 30.0^\circ$.

---

## 6. Manual Test Checklist for All 6 Pages

| Page | Route | Verification Checklist |
|---|---|---|
| **1. Overview** | `/` | 1. Hero displays project overview and sub-₹1,300 BOM cost.<br>2. Live status ribbon displays current state, active satellite, and mount angles.<br>3. BOM table lists 10 items totaling ₹1,216.<br>4. 2026 Roadmap shows milestones M3 to M12.<br>5. Navbar "SET TOKEN" modal accepts token and updates badge to "AUTH OK". |
| **2. Dashboard** | `/dashboard` | 1. Connection badge displays `LIVE` with green pulse.<br>2. Polar Sky Plot displays concentric rings (0°, 30°, 60°), cardinal directions, antenna boresight marker, and target orbit marker.<br>3. Live Az/El numerical readouts and progress bars update at 1 Hz.<br>4. MPU-6050 2D spirit bubble level responds with level indicator.<br>5. Time Sync card displays status and "Sync Time (NTP)" button.<br>6. Next Pass card displays prediction and tracking toggle. |
| **3. Control** | `/control` | 1. Satellite picker lists NavIC constellations and ISS.<br>2. Manual Jog allows choosing Az (0–360°) and El (0–90°).<br>3. Slew $> 30^\circ$ triggers the confirmation dialog before sending.<br>4. Homing button triggers confirmation dialog before sending.<br>5. Disconnecting WS or clearing token disables controls with explanatory banner.<br>6. Server rejections (401, 429) display clear error alerts. |
| **4. TLE** | `/tle` | 1. Shows active TLE with breakdown of Keplerian elements.<br>2. TLE editor validates line length (69 chars) and NORAD modulo-10 checksum.<br>3. Invalid checksum or mismatched NORAD ID displays validation errors.<br>4. File upload parses `.tle` / `.txt` files.<br>5. Presets allow loading or direct application of NavIC 1B–1I orbits. |
| **5. Settings** | `/settings` | 1. Displays observer Latitude, Longitude, and Altitude with "Use Browser GPS" button.<br>2. Displays steps-per-degree, zero offsets, backlash compensation, and speed limits.<br>3. Modifying any field shows "Unsaved Changes" badge.<br>4. Client validates boundaries (speed $\le 5^\circ/\text{s}$, Lat $\in [-90,90]$).<br>5. "Save Configuration" sends authenticated `POST /api/v1/config`. |
| **6. Logs** | `/logs` | 1. Interactive time-series SVG chart plots Commanded vs Actual angles.<br>2. Hovering over chart displays discrete telemetry frame values.<br>3. Logs table displays timestamp, angles, pointing error, and state.<br>4. Logs persist offline via browser IndexedDB.<br>5. "Export CSV" generates downloadable `.csv` file. |

---

## 7. Assumptions & Firmware API Alignment Notes

The web dashboard is aligned with [`docs/API.md`](file:///c:/Users/pc/Downloads/DTU/docs/API.md). When writing or porting the ESP32 C++/Arduino firmware, take note of the following:

1. **Lean WebSocket Telemetry Frame (`/ws`)**:
   - The web app expects JSON frames strictly under 300 bytes formatted as:
     `{"t":..., "st":"TRACKING", "hm":1, "c":[az,el], "tg":[az,el], "err":..., "imu":[pitch,roll,isLevel], "sat":"...", "rssi":...}`.
   - The client decoder in `src/lib/decoder.ts` expands these shorthand keys.
2. **In-Memory Ring Buffer (`GET /api/v1/logs`)**:
   - The ESP32 is only expected to store a circular buffer of the last 100–200 points in RAM.
   - The web app automatically ingests these and stores long-term pass history in browser IndexedDB.
3. **Time Sync (`POST /api/v1/time`)**:
   - Supports `{ "action": "NTP_SYNC" }` and `{ "action": "MANUAL", "timestamp": "ISO..." }`.
   - ESP32 should set its internal system time (`settimeofday`) to prevent SGP4 drift.
4. **Helper Endpoints**:
   - `GET /api/v1/satellites`: If the ESP32 firmware only has memory to store the active TLE, it can omit this endpoint; the web app includes fallback catalog presets.
   - `GET /api/v1/prediction`: If the ESP32 lacks floating-point pass prediction routines, pass predictions can be handled client-side using `satellite.js`.

