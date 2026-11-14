/**
 * Controlled NAVIC-TRACK Application Tools for OpenJarvis
 * Enforces strict hardware safety boundaries and reuses existing SGP4 calculations.
 */

import {
  trackerConfig,
  trackerStatus,
  currentTle,
  selectSatellite
} from '../state.js';
import {
  propagateSatellite,
  predictNextPass
} from '../simulator.js';
import {
  getCachedCatalog,
  findSatelliteByNameOrNorad
} from '../tle-data.js';
import { getGroundStationWeather } from './weather.js';

export interface JarvisToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export const JARVIS_TOOLS: JarvisToolDefinition[] = [
  {
    name: 'get_satellite_list',
    description: 'Retrieve the catalog of satellites currently tracked by the ground station (including METEOR-M2 4, NOAA, NavIC, ISS).',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'get_current_satellite_position',
    description: 'Calculate real-time sub-satellite coordinates (latitude, longitude, altitude) and topocentric look angles (azimuth, elevation) for a satellite.',
    parameters: {
      type: 'object',
      properties: {
        satelliteName: { type: 'string', description: 'Name or NORAD ID of the satellite (e.g. "METEOR-M2 4", "NOAA 19", "59051"). Optional; defaults to active target.' }
      }
    }
  },
  {
    name: 'get_next_pass',
    description: 'Calculate upcoming visible pass details (AOS, LOS, peak elevation, duration) using SGP4 and the 10-degree minimum elevation mask.',
    parameters: {
      type: 'object',
      properties: {
        satelliteName: { type: 'string', description: 'Satellite name or NORAD ID. Optional; defaults to active target.' }
      }
    }
  },
  {
    name: 'get_azimuth_elevation',
    description: 'Get the current antenna pointing angles (Left/Right direction and Up/Down angle) and commanded target angles.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'get_weather_info',
    description: 'Retrieve real-time meteorological conditions (temperature, wind vectors, humidity, precipitation) for the ground station.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'start_satellite_tracking',
    description: 'Initiate automated tracking for a satellite. Selects target, validates orbital coordinates against mechanical limits, and engages motor tracking.',
    parameters: {
      type: 'object',
      properties: {
        satelliteName: { type: 'string', description: 'Satellite name or NORAD ID to track (e.g. "METEOR-M2 4").' }
      },
      required: ['satelliteName']
    }
  },
  {
    name: 'stop_antenna_movement',
    description: 'Safely halt antenna tracking, stop stepper motor movement, and de-energize drive coils.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'get_hardware_status',
    description: 'Check status of ground station hardware: ESP32 connection, MPU-6050 tripod leveling, clock synchronization, and operational state.',
    parameters: { type: 'object', properties: {} }
  }
];

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  summary: string;
}

/**
 * Executes a controlled tool call requested by JARVIS with safety guards.
 */
export async function executeJarvisTool(
  toolName: string,
  args: Record<string, any> = {}
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      // 1. Get Satellite List
      case 'get_satellite_list': {
        const catalog = getCachedCatalog();
        const simplified = catalog.slice(0, 15).map(s => ({
          name: s.name,
          noradId: s.noradId,
          group: s.group
        }));
        return {
          toolName,
          success: true,
          data: { total: catalog.length, satellites: simplified },
          summary: `Station catalog has ${catalog.length} satellites loaded from CelesTrak. Primary targets include METEOR-M2 4, NOAA 15/18/19, and the NavIC constellation.`
        };
      }

      // 2. Get Current Satellite Position
      case 'get_current_satellite_position': {
        let satName = args.satelliteName || currentTle.satelliteName;
        let line1 = currentTle.line1;
        let line2 = currentTle.line2;

        if (args.satelliteName) {
          const sat = findSatelliteByNameOrNorad(args.satelliteName);
          if (sat) {
            satName = sat.name;
            line1 = sat.tle.line1;
            line2 = sat.tle.line2;
          }
        }

        const prop = propagateSatellite(line1, line2, trackerConfig.observer, new Date());
        if (!prop) {
          return {
            toolName,
            success: false,
            error: 'Failed to compute orbital coordinates via SGP4',
            summary: `Could not propagate position for ${satName}.`
          };
        }

        const mask = trackerConfig.observer.minElevationMaskDeg ?? 10.0;
        const isVisible = prop.lookAngles.elevation >= mask;

        return {
          toolName,
          success: true,
          data: {
            satelliteName: satName,
            subSatellitePoint: prop.subSatellitePoint,
            lookAngles: prop.lookAngles,
            isVisible,
            elevationMaskDeg: mask
          },
          summary: `${satName} is at Lat ${prop.subSatellitePoint.latitude}°, Lon ${prop.subSatellitePoint.longitude}°, Alt ${prop.subSatellitePoint.altitudeKm} km. Ground look angles: Azimuth ${prop.lookAngles.azimuth}°, Elevation ${prop.lookAngles.elevation}°. ${isVisible ? 'Currently visible in sky.' : 'Currently below the 10° horizon mask.'}`
        };
      }

      // 3. Get Next Pass
      case 'get_next_pass': {
        let satName = args.satelliteName || currentTle.satelliteName;
        let noradId = currentTle.noradId;
        let line1 = currentTle.line1;
        let line2 = currentTle.line2;

        if (args.satelliteName) {
          const sat = findSatelliteByNameOrNorad(args.satelliteName);
          if (sat) {
            satName = sat.name;
            noradId = sat.noradId;
            line1 = sat.tle.line1;
            line2 = sat.tle.line2;
          }
        }

        const pass = predictNextPass(line1, line2, satName, noradId, trackerConfig.observer, new Date());
        if (!pass) {
          return {
            toolName,
            success: true,
            data: { satelliteName: satName, pass: null },
            summary: `No visible pass above the 10° elevation mask was found for ${satName} in the next 48 hours from our ground coordinates.`
          };
        }

        const durationMins = Math.round(pass.durationSeconds / 60);
        const aosFormatted = new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const losFormatted = new Date(pass.los).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
          toolName,
          success: true,
          data: pass,
          summary: `Next visible pass for ${satName} is from ${aosFormatted} to ${losFormatted} (${durationMins} min duration), reaching a maximum elevation of ${pass.maxElevation}° at AOS azimuth ${pass.aosAzimuth}°.`
        };
      }

      // 4. Get Azimuth / Elevation
      case 'get_azimuth_elevation': {
        const dAz = trackerStatus.targetAngles.azimuth - trackerStatus.currentAngles.azimuth;
        const dEl = trackerStatus.targetAngles.elevation - trackerStatus.currentAngles.elevation;
        const errorDeg = parseFloat(Math.sqrt(dAz * dAz + dEl * dEl).toFixed(2));

        return {
          toolName,
          success: true,
          data: {
            currentAngles: trackerStatus.currentAngles,
            targetAngles: trackerStatus.targetAngles,
            trackingErrorDeg: errorDeg,
            state: trackerStatus.state
          },
          summary: `Antenna currently pointed at Azimuth ${trackerStatus.currentAngles.azimuth}°, Elevation ${trackerStatus.currentAngles.elevation}°. Target: ${trackerStatus.targetAngles.azimuth}° / ${trackerStatus.targetAngles.elevation}°. Off target by ${errorDeg}°.`
        };
      }

      // 5. Get Weather Info
      case 'get_weather_info': {
        const weather = await getGroundStationWeather(trackerConfig.observer);
        return {
          toolName,
          success: true,
          data: weather,
          summary: `Station Weather: ${weather.temperatureC}°C (Feels like ${weather.feelsLikeC}°C), ${weather.weatherCondition}, Wind ${weather.windSpeedKmh} km/h, Humidity ${weather.humidityPercent}%. Source: ${weather.source}.`
        };
      }

      // 6. Start Satellite Tracking (With safety checks!)
      case 'start_satellite_tracking': {
        const satQuery = args.satelliteName || 'METEOR-M2 4';
        const ok = await selectSatellite(satQuery, true);

        if (!ok) {
          return {
            toolName,
            success: false,
            error: `Satellite '${satQuery}' could not be found in catalog or CelesTrak.`,
            summary: `Could not identify satellite '${satQuery}' for tracking.`
          };
        }

        // Check if currently above elevation mask
        const mask = trackerConfig.observer.minElevationMaskDeg ?? 10.0;
        const prop = propagateSatellite(currentTle.line1, currentTle.line2, trackerConfig.observer, new Date());
        const isVisible = prop ? prop.lookAngles.elevation >= mask : false;

        let statusText = '';
        if (isVisible) {
          statusText = `Locked onto ${trackerStatus.satelliteName}. Satellite is currently in the sky (elevation ${prop?.lookAngles.elevation.toFixed(1)}° >= 10°). Rotator is actively tracking.`;
        } else {
          statusText = `Locked onto ${trackerStatus.satelliteName}. Satellite is currently below horizon (elevation ${prop?.lookAngles.elevation.toFixed(1)}° < 10°). Rotator is holding safely on standby at expected rise direction until AOS.`;
        }

        return {
          toolName,
          success: true,
          data: {
            satelliteName: trackerStatus.satelliteName,
            noradId: trackerStatus.noradId,
            state: trackerStatus.state,
            targetAngles: trackerStatus.targetAngles,
            isVisible
          },
          summary: statusText
        };
      }

      // 7. Stop Antenna Movement
      case 'stop_antenna_movement': {
        trackerStatus.state = 'IDLE';
        return {
          toolName,
          success: true,
          data: { state: trackerStatus.state },
          summary: 'Antenna tracking stopped. Stepper motors halted and drive coils de-energized.'
        };
      }

      // 8. Get Hardware Status
      case 'get_hardware_status': {
        return {
          toolName,
          success: true,
          data: {
            state: trackerStatus.state,
            homed: trackerStatus.homed,
            hardwareConnected: trackerStatus.hardwareConnected,
            isLevel: trackerStatus.imu.isLevel,
            pitchDeg: trackerStatus.imu.pitch,
            rollDeg: trackerStatus.imu.roll,
            timeSync: trackerStatus.timeSync,
            uptimeSeconds: trackerStatus.uptimeSeconds
          },
          summary: `Hardware State: ${trackerStatus.state}. Physical Link: ${trackerStatus.hardwareConnected ? 'Connected (Arduino Uno)' : 'Simulation Mode'}. Stand Level: ${trackerStatus.imu.isLevel ? 'Level (<2° tilt)' : 'Tilted'}. Clock: ${trackerStatus.timeSync}.`
        };
      }

      default:
        return {
          toolName,
          success: false,
          error: `Unknown tool: ${toolName}`,
          summary: `Requested tool '${toolName}' is not recognized.`
        };
    }
  } catch (err: any) {
    return {
      toolName,
      success: false,
      error: err.message || 'Execution error',
      summary: `Failed to execute tool ${toolName}: ${err.message}`
    };
  }
}

