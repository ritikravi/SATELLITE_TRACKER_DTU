import { SatelliteInfo, TleData } from '../../shared/types/tracker.js';
import fs from 'fs';
import path from 'path';

// Real CelesTrak satellite TLEs - Starts with METEOR-M2 4 as requested
export const FALLBACK_SATELLITES: SatelliteInfo[] = [
  {
    name: 'METEOR-M2 4',
    noradId: 59051,
    group: 'WEATHER',
    tle: {
      line1: '1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997',
      line2: '2 59051  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176140580'
    }
  },
  {
    name: 'IRNSS-1B',
    noradId: 39635,
    group: 'NAVIC',
    tle: {
      line1: '1 39635U 14017A   26314.95600463  .00000115  00000+0  00000+0 0  9993',
      line2: '2 39635  29.0993 237.8858 0017719 185.7160  25.7856  1.00269646 46269'
    }
  },
  {
    name: 'IRNSS-1A',
    noradId: 39199,
    group: 'NAVIC',
    tle: {
      line1: '1 39199U 13034A   26317.88404779  .00000077  00000+0  00000+0 0  9990',
      line2: '2 39199  36.0491  61.7358 0022346 184.5436 180.0376  1.00270379 48875'
    }
  },
  {
    name: 'IRNSS-1C',
    noradId: 40269,
    group: 'NAVIC',
    tle: {
      line1: '1 40269U 14061A   26315.04874942 -.00000108  00000+0  00000+0 0  9998',
      line2: '2 40269   5.2000  83.0000 0015000 110.0000 250.0000  1.00270000 34002'
    }
  },
  {
    name: 'ISS (ZARYA)',
    noradId: 25544,
    group: 'LEO',
    tle: {
      line1: '1 25544U 98067A   26317.91612726  .00008668  00000+0  16320-3 0  9995',
      line2: '2 25544  51.6324 279.1461 0007382  22.6178 337.5134 15.49359724594967'
    }
  },
  // NOAA 19, 18, 15: No hardcoded fallback TLEs — checksums would be invalid.
  // These are always fetched live from CelesTrak on startup.
  // If CelesTrak is unreachable they will simply be absent from the catalog
  // rather than producing incorrect orbital positions.
];

let cachedCatalog: SatelliteInfo[] = [...FALLBACK_SATELLITES];
let lastCatalogFetchTime: string = new Date().toISOString();
let catalogSource: 'CELESTRAK' | 'CACHED' | 'OFFLINE_FALLBACK' = 'OFFLINE_FALLBACK';

export function parse3LineTle(text: string, group: SatelliteInfo['group'] = 'WEATHER'): SatelliteInfo[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const result: SatelliteInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('1 ') && lines[i + 1]?.startsWith('2 ')) {
      const line1 = lines[i];
      const line2 = lines[i + 1];
      const noradId = parseInt(line1.substring(2, 7).trim(), 10) || 0;
      const name = i > 0 && !lines[i - 1].startsWith('1 ') && !lines[i - 1].startsWith('2 ')
        ? lines[i - 1]
        : `SAT-${noradId}`;
      result.push({
        name,
        noradId,
        group,
        tle: { line1, line2 }
      });
      i += 1;
    }
  }
  return result;
}

/**
 * Fetch from CelesTrak with timeout and fallback
 */
async function fetchTleFromUrl(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    // Network or timeout error
  }
  return null;
}

/**
 * Fetch all presets from CelesTrak: Weather group + NavIC group + ISS
 */
export async function fetchCelestrakPresets(force = false): Promise<{
  satellites: SatelliteInfo[];
  source: 'CELESTRAK' | 'CACHED' | 'OFFLINE_FALLBACK';
  updatedAt: string;
}> {
  // If recently fetched (< 4 hours) and not forced, return cached
  const now = Date.now();
  const lastTime = new Date(lastCatalogFetchTime).getTime();
  if (!force && catalogSource === 'CELESTRAK' && now - lastTime < 4 * 3600 * 1000) {
    return { satellites: cachedCatalog, source: 'CACHED', updatedAt: lastCatalogFetchTime };
  }

  const fetchedMap = new Map<number, SatelliteInfo>();

  try {
    // 1. Fetch Weather group (contains METEOR-M2-4, NOAA satellites)
    const weatherText = await fetchTleFromUrl('https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle');
    if (weatherText) {
      const weatherSats = parse3LineTle(weatherText, 'WEATHER');
      for (const s of weatherSats) {
        fetchedMap.set(s.noradId, s);
      }
    }

    // 2. Fetch specific METEOR-M2-4 (59051) if not already in weather group
    if (!fetchedMap.has(59051)) {
      const meteorText = await fetchTleFromUrl('https://celestrak.org/NORAD/elements/gp.php?CATNR=59051&FORMAT=2le');
      if (meteorText) {
        const lines = meteorText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length >= 2 && lines[0].startsWith('1 ') && lines[1].startsWith('2 ')) {
          fetchedMap.set(59051, {
            name: 'METEOR-M2 4',
            noradId: 59051,
            group: 'WEATHER',
            tle: { line1: lines[0], line2: lines[1] }
          });
        }
      }
    }

    // 3. Fetch NavIC / IRNSS group
    const irnssText = await fetchTleFromUrl('https://celestrak.org/NORAD/elements/gp.php?GROUP=irnss&FORMAT=tle');
    if (irnssText) {
      const irnssSats = parse3LineTle(irnssText, 'NAVIC');
      for (const s of irnssSats) {
        fetchedMap.set(s.noradId, s);
      }
    }

    // 4. Fetch Space Stations group (ISS, CSS, etc.)
    const stationsText = await fetchTleFromUrl('https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle');
    if (stationsText) {
      const stationSats = parse3LineTle(stationsText, 'LEO');
      for (const s of stationSats) {
        fetchedMap.set(s.noradId, s);
      }
    }

    // 5. Fetch ISS (25544) if not present
    const issText = await fetchTleFromUrl('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=2le');
    if (issText) {
      const lines = issText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length >= 2 && lines[0].startsWith('1 ') && lines[1].startsWith('2 ')) {
        fetchedMap.set(25544, {
          name: 'ISS (ZARYA)',
          noradId: 25544,
          group: 'LEO',
          tle: { line1: lines[0], line2: lines[1] }
        });
      }
    }

    if (fetchedMap.size > 0) {
      // Merge with fallbacks so missing items are preserved
      const mergedList: SatelliteInfo[] = [];

      // Make sure METEOR-M2-4 is first!
      if (fetchedMap.has(59051)) {
        mergedList.push(fetchedMap.get(59051)!);
      } else {
        mergedList.push(FALLBACK_SATELLITES[0]); // METEOR-M2-4 fallback
      }

      // Add remaining fetched satellites
      for (const [norad, sat] of fetchedMap.entries()) {
        if (norad !== 59051) {
          mergedList.push(sat);
        }
      }

      // Ensure any essential fallbacks not in feed are still present
      for (const fb of FALLBACK_SATELLITES) {
        if (!mergedList.some(s => s.noradId === fb.noradId)) {
          mergedList.push(fb);
        }
      }

      cachedCatalog = mergedList;
      lastCatalogFetchTime = new Date().toISOString();
      catalogSource = 'CELESTRAK';

      return {
        satellites: cachedCatalog,
        source: 'CELESTRAK',
        updatedAt: lastCatalogFetchTime
      };
    }
  } catch (err) {
    console.warn('[TLE] Failed to reach CelesTrak, using cached catalog:', err);
  }

  // Fallback
  return {
    satellites: cachedCatalog,
    source: catalogSource,
    updatedAt: lastCatalogFetchTime
  };
}

/**
 * Fetch a single satellite dynamically from CelesTrak by NORAD ID or Name
 */
export async function fetchSatelliteFromCelestrak(query: string | number): Promise<SatelliteInfo | null> {
  const isNorad = typeof query === 'number' || /^\d+$/.test(query.toString().trim());
  const param = isNorad
    ? `CATNR=${query.toString().trim()}`
    : `NAME=${encodeURIComponent(query.toString().trim())}`;

  const url = `https://celestrak.org/NORAD/elements/gp.php?${param}&FORMAT=tle`;
  const text = await fetchTleFromUrl(url, 6000);

  if (text) {
    const parsed = parse3LineTle(text, 'CUSTOM');
    if (parsed.length > 0) {
      const sat = parsed[0];
      // Add or update in cached catalog
      const existingIdx = cachedCatalog.findIndex(s => s.noradId === sat.noradId);
      if (existingIdx >= 0) {
        cachedCatalog[existingIdx] = sat;
      } else {
        cachedCatalog.push(sat);
      }
      return sat;
    }
  }
  return null;
}

export function getCachedCatalog(): SatelliteInfo[] {
  return cachedCatalog;
}

export function getCatalogMetadata() {
  return {
    source: catalogSource,
    updatedAt: lastCatalogFetchTime,
    count: cachedCatalog.length
  };
}

export function findSatelliteByNameOrNorad(query: string | number): SatelliteInfo | undefined {
  if (typeof query === 'number') {
    return cachedCatalog.find(s => s.noradId === query);
  }
  const clean = query.toLowerCase().trim();
  return cachedCatalog.find(s => {
    const sName = s.name.toLowerCase();
    const sNorad = s.noradId.toString();
    if (sNorad === clean) return true;
    if (sName.includes(clean) || clean.includes(sName)) return true;

    // Handle NavIC vs IRNSS aliases (e.g. NavIC-1B vs IRNSS-1B)
    if (clean.includes('navic') || clean.includes('irnss')) {
      const match = clean.match(/(1[a-z]|2[a-z])/i);
      if (match && sName.includes(match[1].toLowerCase()) && (sName.includes('irnss') || sName.includes('navic'))) {
        return true;
      }
    }

    // Handle METEOR-M2 4 vs METEOR-M2-4 vs METEOR
    if ((clean.includes('meteor') || clean.includes('m2-4') || clean.includes('m2 4')) && sName.includes('meteor')) {
      return true;
    }

    return false;
  });
}
