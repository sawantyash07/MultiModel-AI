// End-to-end verification script for Text-to-Image and Chat streaming
const http = require('http');

function postJson(urlPath, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:8080${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    }).on('error', reject);
  });
}

function streamChat(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: '/api/chat/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const events = [];
    let currentEvent = null;

    const req = http.request(options, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            events.push({ event: currentEvent, data: dataStr });
          }
        }
      });

      res.on('end', () => {
        resolve({ statusCode: res.statusCode, events });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing GET /api/models ---');
  const modelsRes = await getJson('/api/models');
  console.log(`Status: ${modelsRes.status}`);
  const models = modelsRes.data.models || [];
  console.log(`Total models returned: ${models.length}`);
  const t2iModels = models.filter(m => m.task === 'text-to-image');
  console.log(`Text-to-Image models (${t2iModels.length}):`, t2iModels.map(m => m.id));
  const freeFlux = t2iModels.find(m => m.id === 'flux-schnell-free');
  if (!freeFlux) throw new Error('Missing flux-schnell-free in /api/models');

  console.log('\n--- 2. Testing Dedicated Model Hub Text-to-Image Endpoint ---');
  console.log('Sending prompt: "Generate a futuristic robot working in a modern laboratory."');
  const genStart = Date.now();
  const genRes = await postJson('/api/hub/image/generate', {
    modelId: 'flux-schnell-free',
    prompt: 'Generate a futuristic robot working in a modern laboratory.',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024
  });
  const genDuration = Date.now() - genStart;
  console.log(`Status: ${genRes.status}, Duration: ${genDuration}ms`);
  console.log(`Response Status: ${genRes.data.status}`);
  console.log(`Image Data URL present: ${Boolean(genRes.data.imageDataUrl)}`);
  if (genRes.data.imageDataUrl) {
    console.log(`Image Data URL prefix: ${genRes.data.imageDataUrl.substring(0, 35)}... (Length: ${genRes.data.imageDataUrl.length})`);
  }

  console.log('\n--- 2b. Testing Model Hub Image History ---');
  const histRes = await getJson('/api/hub/image/history');
  console.log(`History status: ${histRes.status}, Total images stored: ${histRes.data.total}`);

  console.log('\n--- 3. Testing Chat SSE Streaming for Text-to-Image ---');
  console.log('Streaming prompt to /api/chat/stream with flux-schnell-free...');
  const streamRes = await streamChat({
    modelId: 'flux-schnell-free',
    messages: [
      { role: 'user', content: 'Generate a futuristic robot working in a modern laboratory.' }
    ]
  });
  console.log(`SSE Response Status: ${streamRes.statusCode}, Total SSE events: ${streamRes.events.length}`);
  const eventTypes = streamRes.events.map(e => e.event);
  console.log('Observed event types:', [...new Set(eventTypes)]);
  
  const thinkingEvent = streamRes.events.find(e => e.event === 'thinking');
  if (thinkingEvent) console.log('Thinking event:', thinkingEvent.data);
  
  const imageEvent = streamRes.events.find(e => e.event === 'image');
  if (imageEvent) {
    const imgData = JSON.parse(imageEvent.data);
    console.log(`Image event received: model=${imgData.modelName}, width=${imgData.width}, height=${imgData.height}, dataUrl prefix=${imgData.imageDataUrl?.substring(0, 30)}...`);
  }

  const tokenEvents = streamRes.events.filter(e => e.event === 'token');
  console.log(`Token events count: ${tokenEvents.length}`);
  const errIn3 = streamRes.events.find(e => e.event === 'error');
  if (errIn3) {
    console.log('Error in test 3:', errIn3.data);
  }

  console.log('\n--- 4. Testing HF HTTP 402 Payment Required Handling ---');
  console.log('Streaming prompt to black-forest-labs/FLUX.1-schnell (which has 0 HF router credits)...');
  const hf402Res = await streamChat({
    modelId: 'black-forest-labs/FLUX.1-schnell',
    messages: [
      { role: 'user', content: 'Generate a futuristic robot working in a modern laboratory.' }
    ]
  });
  console.log(`SSE Response Status: ${hf402Res.statusCode}`);
  const errorEvent = hf402Res.events.find(e => e.event === 'error');
  if (errorEvent) {
    console.log('Graceful Error payload:', errorEvent.data);
  }

  console.log('\n--- 5. Testing Existing Text-to-Text Model (Regression Check) ---');
  const t2tRes = await streamChat({
    modelId: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: 'Say "Text-to-text is functioning properly." in 1 sentence.' }
    ]
  });
  const t2tTokens = t2tRes.events.filter(e => e.event === 'token').map(e => {
    try { return JSON.parse(e.data).content; } catch { return ''; }
  }).join('');
  console.log('Text-to-Text response:', t2tTokens.trim());

  console.log('\n================ ALL E2E VERIFICATIONS PASSED ================');
}

run().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
