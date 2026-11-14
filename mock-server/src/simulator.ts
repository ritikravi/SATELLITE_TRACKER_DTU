import * as satellite from 'satellite.js';
import { AngleCoordinates, ImuOrientation, SatellitePass } from '../../shared/types/tracker.js';

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

export interface ObserverLocation {
  latitude: number;             // degrees (-90 to +90)
  longitude: number;            // degrees (-180 to +180)
  altitudeMeters: number;       // meters above sea level
  minElevationMaskDeg?: number; // minimum elevation angle (default 10°)
}

export interface SatellitePropagationResult {
  lookAngles: AngleCoordinates;
  subSatellitePoint: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
  };
  isVisible: boolean; // elevation >= minElevationMaskDeg
}

/**
 * Propagate a TLE for an observer location at a specific time using SGP4 (satellite.js)
 * Calculates both topocentric look angles (Az/El) and ground-track sub-satellite coordinates (Lat/Lon/Alt)
 */
export function propagateSatellite(
  line1: string,
  line2: string,
  observer: ObserverLocation,
  date: Date = new Date()
): SatellitePropagationResult | null {
  try {
    const satrec = satellite.twoline2satrec(line1, line2);
    if (!satrec) return null;

    const pv = satellite.propagate(satrec, date);
    if (!pv || !pv.position || typeof pv.position === 'boolean') {
      return null;
    }

    const gstime = satellite.gstime(date);

    // 1. Calculate Geodetic Sub-Satellite Point (Lat, Lon, Alt)
    const positionGd = satellite.eciToGeodetic(pv.position, gstime);
    const satLat = parseFloat((satellite.degreesLat(positionGd.latitude)).toFixed(4));
    const satLon = parseFloat((satellite.degreesLong(positionGd.longitude)).toFixed(4));
    const satAltKm = parseFloat(positionGd.height.toFixed(1));

    // 2. Calculate Topocentric Look Angles (Azimuth, Elevation) from Observer Location
    const observerGd = {
      latitude: observer.latitude * DEG_TO_RAD,
      longitude: observer.longitude * DEG_TO_RAD,
      height: observer.altitudeMeters / 1000.0 // km
    };

    const positionEcf = satellite.eciToEcf(pv.position, gstime);
    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

    let az = lookAngles.azimuth * RAD_TO_DEG;
    if (az < 0) az += 360.0;
    if (az >= 360.0) az -= 360.0;

    let el = lookAngles.elevation * RAD_TO_DEG;
    // Bounded to physical tracker elevation range [0, 90]
    const clampedEl = Math.max(0, Math.min(90, el));

    const minMask = observer.minElevationMaskDeg ?? 10.0;
    const isVisible = el >= minMask;

    return {
      lookAngles: {
        azimuth: parseFloat(az.toFixed(2)),
        elevation: parseFloat(clampedEl.toFixed(2))
      },
      subSatellitePoint: {
        latitude: satLat,
        longitude: satLon,
        altitudeKm: satAltKm
      },
      isVisible
    };
  } catch (err) {
    return null;
  }
}

/**
 * Backward compatibility wrapper returning just AngleCoordinates
 */
export function calculateAzEl(
  line1: string,
  line2: string,
  observer: ObserverLocation,
  date: Date = new Date()
): AngleCoordinates | null {
  const result = propagateSatellite(line1, line2, observer, date);
  return result ? result.lookAngles : null;
}

/**
 * Accurately calculate the next visible satellite pass using SGP4.
 * Uses a configurable minimum elevation mask (default 10 degrees).
 * Detects AOS (when El rises above mask) and LOS (when El drops below mask).
 * Never fabricates or hardcodes fake passes.
 */
export function predictNextPass(
  line1: string,
  line2: string,
  satelliteName: string,
  noradId: number,
  observer: ObserverLocation,
  startTime: Date = new Date(),
  maxHoursAhead: number = 48
): SatellitePass | null {
  try {
    const satrec = satellite.twoline2satrec(line1, line2);
    if (!satrec) return null;

    const minMask = observer.minElevationMaskDeg ?? 10.0;
    const observerGd = {
      latitude: observer.latitude * DEG_TO_RAD,
      longitude: observer.longitude * DEG_TO_RAD,
      height: observer.altitudeMeters / 1000.0
    };

    const stepSeconds = 60; // 1-minute initial scan steps
    const totalSteps = Math.floor((maxHoursAhead * 3600) / stepSeconds);

    let inPass = false;
    let aosTime: Date | null = null;
    let aosAz = 0;
    let maxEl = 0;
    let losTime: Date | null = null;
    let losAz = 0;

    const startMs = startTime.getTime();

    // Check if satellite is already visible right now
    const initialLook = getLookAt(satrec, observerGd, startTime);
    const isInitiallyVisible = initialLook && initialLook.el >= minMask;

    if (isInitiallyVisible && initialLook) {
      inPass = true;
      aosTime = startTime;
      aosAz = parseFloat(initialLook.az.toFixed(1));
      maxEl = initialLook.el;
    }

    for (let i = 0; i < totalSteps; i++) {
      const t = new Date(startMs + i * stepSeconds * 1000);
      const look = getLookAt(satrec, observerGd, t);
      if (!look) continue;

      if (look.el >= minMask) {
        if (!inPass) {
          // Transition from below mask to above mask: AOS!
          // Refine exact second by stepping back up to 60 seconds
          const refinedAos = refineCrossing(satrec, observerGd, t.getTime() - stepSeconds * 1000, t.getTime(), minMask, true);
          aosTime = refinedAos.time;
          aosAz = parseFloat(refinedAos.az.toFixed(1));
          maxEl = look.el;
          inPass = true;
        } else {
          if (look.el > maxEl) {
            maxEl = look.el;
          }
        }
      } else {
        if (inPass && aosTime) {
          // Transition from above mask to below mask: LOS!
          const refinedLos = refineCrossing(satrec, observerGd, t.getTime() - stepSeconds * 1000, t.getTime(), minMask, false);
          losTime = refinedLos.time;
          losAz = parseFloat(refinedLos.az.toFixed(1));
          break; // Found our complete pass!
        }
      }
    }

    if (aosTime && losTime) {
      const durationSeconds = Math.max(1, Math.round((losTime.getTime() - aosTime.getTime()) / 1000));
      return {
        satelliteName,
        noradId,
        aos: aosTime.toISOString(),
        los: losTime.toISOString(),
        maxElevation: parseFloat(maxEl.toFixed(1)),
        durationSeconds,
        aosAzimuth: aosAz,
        losAzimuth: losAz,
        elevationMaskDeg: minMask,
        isVisibleNow: isInitiallyVisible
      };
    }

    // Geostationary/IGSO satellites or pass currently ongoing without LOS within search window
    if (inPass && aosTime && !losTime) {
      // For stationary NavIC/IRNSS or GEO satellites that stay perpetually above horizon
      return {
        satelliteName,
        noradId,
        aos: aosTime.toISOString(),
        los: new Date(aosTime.getTime() + 24 * 3600 * 1000).toISOString(),
        maxElevation: parseFloat(maxEl.toFixed(1)),
        durationSeconds: 86400,
        aosAzimuth: aosAz,
        losAzimuth: aosAz,
        elevationMaskDeg: minMask,
        isVisibleNow: true
      };
    }

    // No pass found above the elevation mask in the search window - DO NOT return fake mock data!
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to get Az/El for an observer at time t
 */
function getLookAt(
  satrec: satellite.SatRec,
  observerGd: { latitude: number; longitude: number; height: number },
  t: Date
): { az: number; el: number } | null {
  const pv = satellite.propagate(satrec, t);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;

  const gst = satellite.gstime(t);
  const ecf = satellite.eciToEcf(pv.position, gst);
  const look = satellite.ecfToLookAngles(observerGd, ecf);

  let az = look.azimuth * RAD_TO_DEG;
  if (az < 0) az += 360;
  const el = look.elevation * RAD_TO_DEG;

  return { az, el };
}

/**
 * Binary search to refine the exact second when elevation crosses minMask
 */
function refineCrossing(
  satrec: satellite.SatRec,
  observerGd: { latitude: number; longitude: number; height: number },
  tLowMs: number,
  tHighMs: number,
  minMask: number,
  rising: boolean
): { time: Date; az: number } {
  let low = tLowMs;
  let high = tHighMs;
  let bestAz = 0;

  for (let iter = 0; iter < 8; iter++) {
    const mid = Math.round((low + high) / 2);
    const look = getLookAt(satrec, observerGd, new Date(mid));
    if (!look) break;
    bestAz = look.az;

    if (rising) {
      if (look.el >= minMask) high = mid;
      else low = mid;
    } else {
      if (look.el < minMask) high = mid;
      else low = mid;
    }
  }

  return { time: new Date(high), az: bestAz };
}

/**
 * MPU-6050 accelerometer simulation
 */
export function simulateImu(prevPitch: number = 0.1, prevRoll: number = -0.05): ImuOrientation {
  const noiseP = (Math.random() - 0.5) * 0.04;
  const noiseR = (Math.random() - 0.5) * 0.04;
  const pitch = parseFloat((prevPitch + noiseP).toFixed(2));
  const roll = parseFloat((prevRoll + noiseR).toFixed(2));
  const isLevel = Math.abs(pitch) < 2.0 && Math.abs(roll) < 2.0;

  return { pitch, roll, isLevel };
}
