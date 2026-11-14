/**
 * Shared Type Definitions for NAVIC-TRACK API v1 and WebSocket Telemetry
 * Compatible with ESP32 REST/WebSocket Firmware & Next.js Client
 */

// Tracking operational states
export type TrackingState =
  | 'IDLE'
  | 'TRACKING'
  | 'SLEWING'
  | 'HOMING'
  | 'PARKED'
  | 'ERROR';

// Time synchronization status
export type TimeSyncStatus =
  | 'SYNCED'
  | 'UNSYNCED'
  | 'MANUAL'
  | 'ERROR';

// Angular coordinates bounded by physical tracker envelope
export interface AngleCoordinates {
  azimuth: number;   // 0.0 to 360.0 degrees
  elevation: number; // 0.0 to 90.0 degrees
}

// IMU attitude information (from MPU-6050)
export interface ImuOrientation {
  pitch: number;    // Tilt in degrees (-90 to +90)
  roll: number;     // Roll in degrees (-180 to +180)
  isLevel: boolean; // Level within threshold (< 2.0 degrees)
}

// Status payload returned by GET /api/v1/status
export interface TrackerStatus {
  state: TrackingState;
  homed: boolean;
  currentAngles: AngleCoordinates;
  targetAngles: AngleCoordinates;
  satelliteName: string | null;
  noradId: number | null;
  satellitePosition?: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
  };
  isVisible?: boolean;
  hardwareConnected?: boolean;
  imu: ImuOrientation;
  timeSync: TimeSyncStatus;
  lastTimeSync: string | null; // ISO 8601 string
  uptimeSeconds: number;
  lastError: string | null;
  firmwareVersion: string;
}

// Observer coordinates and motor calibration configuration (GET / POST /api/v1/config)
export interface TrackerConfig {
  observer: {
    latitude: number;       // -90.0 to 90.0 degrees
    longitude: number;      // -180.0 to 180.0 degrees
    altitudeMeters: number; // Above sea level
    minElevationMaskDeg?: number; // Minimum elevation angle to track (default 10.0°)
  };
  motion: {
    maxAzimuthSpeedDegS: number;      // Max slewing speed (< 5.0 deg/s for 28BYJ-48)
    maxElevationSpeedDegS: number;    // Max slewing speed (< 5.0 deg/s)
    azimuthStepsPerDegree: number;    // Gearbox & pinion calibration factor
    elevationStepsPerDegree: number;  // Gearbox & pinion calibration factor
    azimuthOffsetDeg: number;         // Mechanical alignment offset
    elevationOffsetDeg: number;       // Mechanical alignment offset
    backlashCompensationDeg: number;  // Directional approach compensation
  };
}

// POST /api/v1/satellite
export interface SelectSatelliteRequest {
  noradId?: number;
  name: string;
  autoTrack?: boolean;
}

// Two-Line Element (TLE) representation
export interface TleData {
  satelliteName: string;
  noradId: number;
  line1: string;
  line2: string;
  updatedAt: string; // ISO 8601 string
  source?: 'CELESTRAK' | 'ISRO' | 'MANUAL';
}

// POST /api/v1/tle
export interface SetTleRequest {
  satelliteName: string;
  line1: string;
  line2: string;
}

// POST /api/v1/track
export interface TrackControlRequest {
  action: 'START' | 'STOP' | 'PAUSE';
}

// POST /api/v1/move (Manual Jog/Move)
export interface ManualMoveRequest {
  azimuth: number;    // 0.0 to 360.0 degrees
  elevation: number;  // 0.0 to 90.0 degrees
  speedDegS?: number; // Optional speed clamped to max configured speed
}

// POST /api/v1/home
export interface HomeRequest {
  axis?: 'ALL' | 'AZIMUTH' | 'ELEVATION';
}

// POST /api/v1/time
export interface TimeSyncRequest {
  action: 'NTP_SYNC' | 'MANUAL';
  timestamp?: string; // Required if action === 'MANUAL', ISO 8601 string
}

export interface TimeSyncResponse {
  timeSync: TimeSyncStatus;
  currentTrackerTime: string; // ISO 8601 string
  driftMs?: number;
  message: string;
}

// Telemetry log entry (GET /api/v1/logs)
export interface TelemetryLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  commandedAzimuth: number;
  actualAzimuth: number;
  commandedElevation: number;
  actualElevation: number;
  trackingErrorDeg: number;
  state: TrackingState;
}

// GET /api/v1/logs query params
export interface LogsQuery {
  limit?: number;  // Default 50, max 200 (ring buffer on ESP32/mock)
  since?: string;  // ISO timestamp filter
}

// Lean WebSocket Telemetry Packet (strictly < 300 bytes for ESP32 RAM/radio efficiency)
// Typical serialized length: ~120 - 150 bytes
export interface LeanTelemetryPacket {
  t: number;                  // Timestamp in Unix ms
  st: TrackingState;          // Tracker state
  hm: 0 | 1;                  // Homed flag (1 = true, 0 = false)
  c: [number, number];        // Actual angles [azimuth, elevation]
  tg: [number, number];       // Commanded/target angles [azimuth, elevation]
  err: number;                // Tracking angular error (degrees)
  imu: [number, number, 0 | 1];// IMU attitude [pitch, roll, isLevel (1/0)]
  sat?: string;               // Optional current satellite name abbreviation
  rssi?: number;              // Wi-Fi RSSI (dBm)
  vis?: 0 | 1;                // Satellite above elevation mask (1 = visible)
  pos?: [number, number, number]; // [lat, lon, altKm] sub-satellite point
}

// Client-friendly expanded telemetry structure (hydrated from LeanTelemetryPacket)
export interface TelemetryData {
  timestamp: number;
  state: TrackingState;
  homed: boolean;
  currentAngles: AngleCoordinates;
  targetAngles: AngleCoordinates;
  trackingErrorDeg: number;
  imu: ImuOrientation;
  satelliteName: string | null;
  satellitePosition?: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
  };
  isVisible?: boolean;
  rssi?: number;
}

// Satellite pass prediction item
export interface SatellitePass {
  satelliteName: string;
  noradId: number;
  aos: string;            // Acquisition of Signal (ISO timestamp)
  los: string;            // Loss of Signal (ISO timestamp)
  maxElevation: number;   // Peak elevation in degrees
  durationSeconds: number;
  aosAzimuth: number;
  losAzimuth: number;
  elevationMaskDeg?: number;
  isVisibleNow?: boolean;
}

// Pre-configured satellite item (loaded from TLEs or Celestrak catalog)
export interface SatelliteInfo {
  name: string;
  noradId: number;
  group: 'WEATHER' | 'NAVIC' | 'GPS' | 'LEO' | 'CUSTOM';
  tle: {
    line1: string;
    line2: string;
  };
}

// Standard API Response Wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

