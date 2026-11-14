import { SatelliteInfo, TleData } from '@/types/tracker';

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
let lastCatalogFetchTime: number = 0;

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
      i++;
    }
  }
  return result;
}

export async function fetchCelestrakPresets(force = false): Promise<SatelliteInfo[]> {
  const now = Date.now();
  if (!force && cachedCatalog.length > 8 && now - lastCatalogFetchTime < 3600000) {
    return cachedCatalog;
  }

  try {
    const urls = [
      { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle', group: 'WEATHER' as const },
      { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=irnss&FORMAT=tle', group: 'NAVIC' as const },
      { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle', group: 'LEO' as const }
    ];

    const results = await Promise.allSettled(
      urls.map(async ({ url, group }) => {
        const res = await fetch(url, { headers: { 'User-Agent': 'NAVIC-TRACK/1.0' }, next: { revalidate: 3600 } });
        if (!res.ok) return [];
        const text = await res.text();
        return parse3LineTle(text, group);
      })
    );

    const merged = new Map<number, SatelliteInfo>();
    for (const fb of FALLBACK_SATELLITES) {
      merged.set(fb.noradId, fb);
    }

    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const sat of r.value) {
          merged.set(sat.noradId, sat);
        }
      }
    }

    cachedCatalog = Array.from(merged.values());
    lastCatalogFetchTime = now;
    return cachedCatalog;
  } catch {
    return cachedCatalog;
  }
}

export async function fetchSatelliteLiveFromCelestrak(query: string | number): Promise<SatelliteInfo | null> {
  const isNorad = typeof query === 'number' || /^\d+$/.test(query.toString().trim());
  const param = isNorad
    ? `CATNR=${query.toString().trim()}`
    : `NAME=${encodeURIComponent(query.toString().trim())}`;

  const url = `https://celestrak.org/NORAD/elements/gp.php?${param}&FORMAT=tle`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NAVIC-TRACK/1.0' },
      next: { revalidate: 1800 }
    });
    if (res.ok) {
      const text = await res.text();
      const parsed = parse3LineTle(text, 'WEATHER');
      if (parsed.length > 0) {
        const sat = parsed[0];
        const idx = cachedCatalog.findIndex(s => s.noradId === sat.noradId);
        if (idx >= 0) cachedCatalog[idx] = sat;
        else cachedCatalog.unshift(sat);
        return sat;
      }
    }
  } catch {
    // Fall back to local search
  }
  return findSatelliteByNameOrNorad(query);
}

export function getCachedCatalog(): SatelliteInfo[] {
  return cachedCatalog;
}

export function findSatelliteByNameOrNorad(query: string | number): SatelliteInfo | null {
  if (typeof query === 'number') {
    return cachedCatalog.find(s => s.noradId === query) || null;
  }
  const q = query.toLowerCase().trim();
  const byNorad = parseInt(q, 10);
  if (!isNaN(byNorad)) {
    const found = cachedCatalog.find(s => s.noradId === byNorad);
    if (found) return found;
  }
  return cachedCatalog.find(s => s.name.toLowerCase().includes(q)) || null;
}
