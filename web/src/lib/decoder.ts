import { LeanTelemetryPacket, TelemetryData } from '@shared/types/tracker';

// In-memory cache for full satellite name (hydrated via GET /api/v1/status)
let cachedFullSatelliteName: string | null = null;

export function setCachedSatelliteName(name: string | null): void {
  cachedFullSatelliteName = name;
}

export function getCachedSatelliteName(): string | null {
  return cachedFullSatelliteName;
}

/**
 * Decodes the ultra-lean wire telemetry frame (<300 bytes) sent over WebSocket
 * into a rich, structured TelemetryData object for application UI consumption.
 */
export function decodeTelemetryPacket(packet: LeanTelemetryPacket): TelemetryData {
  // Use the full cached name if it matches or exists, otherwise fallback to wire abbreviation
  let satelliteName = cachedFullSatelliteName;
  if (!satelliteName && packet.sat) {
    satelliteName = packet.sat;
  }

  return {
    timestamp: packet.t,
    state: packet.st,
    homed: packet.hm === 1,
    currentAngles: {
      azimuth: packet.c[0],
      elevation: packet.c[1]
    },
    targetAngles: {
      azimuth: packet.tg[0],
      elevation: packet.tg[1]
    },
    trackingErrorDeg: packet.err,
    imu: {
      pitch: packet.imu[0],
      roll: packet.imu[1],
      isLevel: packet.imu[2] === 1
    },
    satelliteName,
    satellitePosition: packet.pos
      ? {
          latitude: packet.pos[0],
          longitude: packet.pos[1],
          altitudeKm: packet.pos[2]
        }
      : undefined,
    isVisible: packet.vis !== undefined ? packet.vis === 1 : undefined,
    rssi: packet.rssi
  };
}

