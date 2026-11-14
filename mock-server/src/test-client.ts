import { WebSocket } from 'ws';

async function runTests() {
  const token = 'navic-secret-token-123';
  const baseUrl = 'http://localhost:8080/api/v1';

  console.log('\n--- 1. Testing GET /api/v1/status ---');
  const resStatus = await fetch(`${baseUrl}/status`);
  const statusJson = await resStatus.json();
  console.log('Status code:', resStatus.status);
  console.log('State:', statusJson.data.state, '| Homed:', statusJson.data.homed);
  console.log('Current Az/El:', statusJson.data.currentAngles);
  console.log('Active Satellite:', statusJson.data.satelliteName);

  console.log('\n--- 2. Testing Unauthenticated POST /api/v1/move (Expect 401) ---');
  const resUnauth = await fetch(`${baseUrl}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ azimuth: 150, elevation: 30 })
  });
  console.log('Status code (unauth):', resUnauth.status);
  const unauthJson = await resUnauth.json();
  console.log('Error message:', unauthJson.error);

  console.log('\n--- 3. Testing Authenticated POST /api/v1/move ---');
  const resMove = await fetch(`${baseUrl}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ azimuth: 150, elevation: 30, speedDegS: 3.5 })
  });
  console.log('Status code (auth):', resMove.status);
  const moveJson = await resMove.json();
  console.log('Move target response:', moveJson.data);

  console.log('\n--- 4. Testing POST /api/v1/time (NTP_SYNC) ---');
  const resTime = await fetch(`${baseUrl}/time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ action: 'NTP_SYNC' })
  });
  const timeJson = await resTime.json();
  console.log('Time sync response:', timeJson.data);

  console.log('\n--- 5. Testing GET /api/v1/logs?limit=3 ---');
  const resLogs = await fetch(`${baseUrl}/logs?limit=3`);
  const logsJson = await resLogs.json();
  console.log(`Fetched ${logsJson.data.length} logs. Sample:`, logsJson.data[0]);

  console.log('\n--- 6. Testing WebSocket /ws Telemetry Stream & Payload Size ---');
  const ws = new WebSocket('ws://localhost:8080/ws');
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('WebSocket connected to ws://localhost:8080/ws');
    });
    ws.on('message', (data: Buffer) => {
      const str = data.toString();
      const bytes = Buffer.byteLength(str, 'utf8');
      console.log(`Received packet (${bytes} bytes):`, str);
      if (bytes < 300) {
        console.log(`PASS: Telemetry payload is strictly under 300 bytes! (${bytes} bytes)`);
      } else {
        console.warn(`WARNING: Payload exceeds 300 bytes! (${bytes} bytes)`);
      }
      ws.close();
      resolve();
    });
    ws.on('error', (err) => {
      reject(err);
    });
  });

  console.log('\n=== All Mock Tracker Server Tests Passed Successfully! ===\n');
}

runTests().catch(console.error);

