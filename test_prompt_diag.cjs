const http = require('http');
const fs = require('fs');

async function testPrompt(prompt, modelId = 'flux-schnell-free') {
  console.log(`\n=== Testing Prompt: "${prompt}" ===`);
  const payload = JSON.stringify({
    modelId,
    prompt,
    width: 1024,
    height: 1024,
    aspectRatio: '1:1'
  });

  const res = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/hub/image/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  console.log('HTTP Status:', res.status);
  console.log('Response Status:', res.body?.status);
  console.log('Returned Model:', res.body?.modelName);
  console.log('Duration:', res.body?.durationMs, 'ms');
  console.log('Image Data URL present:', Boolean(res.body?.imageDataUrl));
  if (res.body?.imageDataUrl) {
    console.log('Data URL length:', res.body.imageDataUrl.length);
  }
  return res.body;
}

async function run() {
  await testPrompt("Generate a red sports car parked beside a lake, with snow-covered mountains in the background at sunrise.");
}

run().catch(console.error);
