import * as satellite from 'satellite.js';
import { AngleCoordinates, SatellitePass } from '@/types/tracker';

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

export interface ObserverLocation {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  minElevationMaskDeg?: number;
}

export interface SatellitePropagationResult {
  lookAngles: AngleCoordinates;
  subSatellitePoint: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
  };
  isVisible: boolean;
}

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
    const positionGd = satellite.eciToGeodetic(pv.position, gstime);
    const satLat = parseFloat((satellite.degreesLat(positionGd.latitude)).toFixed(4));
    const satLon = parseFloat((satellite.degreesLong(positionGd.longitude)).toFixed(4));
    const satAltKm = parseFloat(positionGd.height.toFixed(1));

    const observerGd = {
      latitude: observer.latitude * DEG_TO_RAD,
      longitude: observer.longitude * DEG_TO_RAD,
      height: observer.altitudeMeters / 1000.0
    };

    const positionEcf = satellite.eciToEcf(pv.position, gstime);
    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

    let az = lookAngles.azimuth * RAD_TO_DEG;
    if (az < 0) az += 360.0;
    if (az >= 360.0) az -= 360.0;

    let el = lookAngles.elevation * RAD_TO_DEG;
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
  } catch {
    return null;
  }
}

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

    const stepSeconds = 60;
    const totalSteps = Math.floor((maxHoursAhead * 3600) / stepSeconds);

    let inPass = false;
    let aosTime: Date | null = null;
    let aosAz = 0;
    let maxEl = 0;
    let losTime: Date | null = null;
    let losAz = 0;

    const startMs = startTime.getTime();
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
          aosTime = t;
          aosAz = parseFloat(look.az.toFixed(1));
          maxEl = look.el;
          inPass = true;
        } else {
          if (look.el > maxEl) maxEl = look.el;
        }
      } else {
        if (inPass && aosTime) {
          losTime = t;
          losAz = parseFloat(look.az.toFixed(1));
          break;
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
        isVisibleNow: Boolean(isInitiallyVisible)
      };
    }

    if (inPass && aosTime && !losTime) {
      return {
        satelliteName,
        noradId,
        aos: aosTime.toISOString(),
        los: new Date(aosTime.getTime() + 86400000).toISOString(),
        maxElevation: parseFloat(maxEl.toFixed(1)),
        durationSeconds: 86400,
        aosAzimuth: aosAz,
        losAzimuth: aosAz,
        elevationMaskDeg: minMask,
        isVisibleNow: true
      };
    }

    return null;
  } catch {
    return null;
  }
}
