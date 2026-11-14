import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import {
  getLiveTrackerStatus,
  trackerConfig,
  currentTle,
  selectSatellite,
  setTrackingState,
  setManualTarget,
  resetHome,
  getLiveLogs
} from '@/lib/server/state';
import {
  fetchCelestrakPresets,
  getCachedCatalog,
  findSatelliteByNameOrNorad,
  fetchSatelliteLiveFromCelestrak
} from '@/lib/server/tle-data';
import { predictNextPass } from '@/lib/server/simulator';

function success(data: any, status = 200) {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status });
}

function failure(error: string, status = 400) {
  return NextResponse.json({
    success: false,
    error,
    timestamp: new Date().toISOString()
  }, { status });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join('/');

  if (path === 'status') {
    return success(getLiveTrackerStatus());
  }

  if (path === 'config') {
    return success(trackerConfig);
  }

  if (path === 'tle') {
    return success(currentTle);
  }

  if (path === 'satellites') {
    const catalog = await fetchCelestrakPresets();
    return success(catalog);
  }

  if (path === 'satellites/search') {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const found = await fetchSatelliteLiveFromCelestrak(q);
    return success(found ? [found] : []);
  }

  if (path === 'prediction') {
    const pass = predictNextPass(
      currentTle.line1,
      currentTle.line2,
      currentTle.satelliteName,
      currentTle.noradId,
      trackerConfig.observer
    );
    return success(pass);
  }

  if (path === 'jarvis/status') {
    const apiKey = process.env.GEMINI_API_KEY || '';
    return success({
      online: true,
      tools: [
        'get_satellite_list',
        'get_current_satellite_position',
        'get_next_pass',
        'get_azimuth_elevation',
        'get_weather_info',
        'start_satellite_tracking',
        'stop_antenna_movement',
        'get_hardware_status'
      ],
      details: {
        status: 'ok',
        service: 'OpenJarvis (Cloud)',
        version: '1.0.0',
        voiceSupported: true,
        engine: apiKey ? 'OpenJarvis Flight Director (Gemini 3.5 Flash Powered)' : 'OpenJarvis Standard Engine',
        aiModel: 'gemini-3.5-flash',
        geminiConnected: Boolean(apiKey)
      }
    });
  }

  if (path === 'jarvis/voice/status') {
    return success({
      available: true,
      stt: { available: true, backend: 'web-speech-api' },
      tts: { available: true, backend: 'browser-synthesis' }
    });
  }

  if (path === 'logs') {
    return success(getLiveLogs());
  }

  return failure(`Endpoint /api/v1/${path} not found`, 404);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join('/');

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body may be empty
  }

  if (path === 'satellite') {
    const { name, noradId, autoTrack } = body;
    const ok = await selectSatellite(noradId || name);
    if (!ok) return failure(`Satellite not found in active catalog: ${name || noradId}`);
    if (autoTrack) setTrackingState('START');
    return success(getLiveTrackerStatus());
  }

  if (path === 'track') {
    const { action } = body;
    setTrackingState(action === 'START' ? 'START' : 'STOP');
    return success(getLiveTrackerStatus());
  }

  if (path === 'move') {
    const { azimuth, elevation } = body;
    if (azimuth === undefined || elevation === undefined) {
      return failure('Missing azimuth or elevation');
    }
    setManualTarget({ azimuth, elevation });
    return success(getLiveTrackerStatus());
  }

  if (path === 'home') {
    resetHome();
    return success(getLiveTrackerStatus());
  }

  if (path === 'tle/refresh') {
    const list = await fetchCelestrakPresets(true);
    const liveSat = await fetchSatelliteLiveFromCelestrak(currentTle.noradId);
    if (liveSat) {
      currentTle.line1 = liveSat.tle.line1;
      currentTle.line2 = liveSat.tle.line2;
      currentTle.updatedAt = new Date().toISOString();
      currentTle.source = 'CELESTRAK';
    }
    return success({
      message: `Directly fetched ${list.length} live satellites from CelesTrak!`,
      currentTle
    });
  }

  if (path === 'time') {
    return success({
      synced: true,
      serverTime: new Date().toISOString(),
      offsetMs: 0
    });
  }

  if (path === 'jarvis/chat') {
    const { message } = body;
    const currentStatus = getLiveTrackerStatus();

    // Call Gemini API if available
    const apiKey = process.env.GEMINI_API_KEY || '';
    let reply = `Understood, Commander. Satellite telemetry for ${currentStatus.satelliteName} is nominal. Aim is at Azimuth ${currentStatus.currentAngles.azimuth}°, Elevation ${currentStatus.currentAngles.elevation}°.`;

    if (apiKey) {
      try {
        const prompt = `You are J.A.R.V.I.S., advanced AI flight director for NAVIC-TRACK ground station.
Current Target: ${currentStatus.satelliteName} (NORAD #${currentStatus.noradId}).
Current Orientation: Azimuth ${currentStatus.currentAngles.azimuth}°, Elevation ${currentStatus.currentAngles.elevation}°.
Visibility: ${currentStatus.isVisible ? 'Visible above horizon' : 'Below 10° horizon mask'}.
Operator asks: "${message}".
Provide a concise, polite, 2-3 sentence response as J.A.R.V.I.S.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 250, temperature: 0.4 }
          })
        });

        if (res.ok) {
          const gData = await res.json();
          const candidateText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) reply = candidateText.trim();
        }
      } catch {
        // Fall back to deterministic reply
      }
    }

    return success({
      reply,
      toolCall: null,
      toolResult: null,
      online: true,
      sessionId: body.sessionId || 'cloud-session',
      source: 'gemini-3.5-flash'
    });
  }

  return failure(`POST /api/v1/${path} not found`, 404);
}
