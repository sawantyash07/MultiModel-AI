const fs = require('fs');
const http = require('http');

// Read or create a real 100x100 red JPEG image for testing
let realImageBuffer;
if (fs.existsSync('test_red.jpg')) {
  realImageBuffer = fs.readFileSync('test_red.jpg');
} else {
  // Base64 of a standard 100x100 red JPEG
  const fallbackJpg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCABkAGQBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AK/AAAAAAAAAAAAAAAAAAAAAAAAAAD//2Q==';
  realImageBuffer = Buffer.from(fallbackJpg, 'base64');
  fs.writeFileSync('test_red.jpg', realImageBuffer);
}
const realImageBase64 = realImageBuffer.toString('base64');

function makeMultipartBody(boundary, fieldName, filename, contentType, buffer) {
  const crlf = '\r\n';
  const head = '--' + boundary + crlf +
    'Content-Disposition: form-data; name="' + fieldName + '"; filename="' + filename + '"' + crlf +
    'Content-Type: ' + contentType + crlf + crlf;
  const tail = crlf + '--' + boundary + '--' + crlf;
  return Buffer.concat([Buffer.from(head, 'utf8'), buffer, Buffer.from(tail, 'utf8')]);
}

async function runTests() {
  console.log('=== TEST 1: Real Image Upload to /api/chat/upload ===');
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const multipartBody = makeMultipartBody(boundary, 'file', 'test_red.jpg', 'image/jpeg', realImageBuffer);

  const res1 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/chat/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': multipartBody.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(multipartBody);
    req.end();
  });
  console.log('Status:', res1.status);
  console.log('Upload Result:', {
    status: res1.body?.status,
    name: res1.body?.name,
    type: res1.body?.type,
    size: res1.body?.size,
    formattedSize: res1.body?.formattedSize,
    dataUrlPrefix: res1.body?.dataUrl?.substring(0, 30)
  });

  console.log('\n=== TEST 2: Empty File Upload Rejection ===');
  const emptyBody = makeMultipartBody(boundary, 'file', 'empty.png', 'image/png', Buffer.alloc(0));
  const res2 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/chat/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': emptyBody.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.write(emptyBody);
    req.end();
  });
  console.log('Status:', res2.status, 'Error:', res2.body.error);

  console.log('\n=== TEST 3: Unsupported File Type Rejection ===');
  const textBody = makeMultipartBody(boundary, 'file', 'document.txt', 'text/plain', Buffer.from('hello'));
  const res3 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/chat/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': textBody.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.write(textBody);
    req.end();
  });
  console.log('Status:', res3.status, 'Error:', res3.body.error);

  console.log('\n=== TEST 4: Live Image-to-Text Chat Inference via /api/chat/stream ===');
  const chatPayload = JSON.stringify({
    modelId: 'gemini-2.5-flash-vision',
    conversationId: 'test-conv-vision-' + Date.now(),
    messages: [
      {
        role: 'user',
        content: 'What is the dominant color in this image? Answer in one word.',
        attachments: [
          {
            name: 'test_red.jpg',
            type: 'image/jpeg',
            dataUrl: 'data:image/jpeg;base64,' + realImageBase64
          }
        ]
      }
    ]
  });

  const res4 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/chat/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(chatPayload)
      }
    }, (res) => {
      let tokens = '';
      res.on('data', chunk => {
        const lines = chunk.toString().split(/\r?\n/);
        for (const l of lines) {
          const trimmed = l.trim();
          if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
            try {
              const p = JSON.parse(trimmed.replace(/^data:\s*/, ''));
              if (p.content) tokens += p.content;
            } catch(e) {}
          }
        }
      });
      res.on('end', () => resolve({ status: res.statusCode, tokens }));
    });
    req.write(chatPayload);
    req.end();
  });
  console.log('Status:', res4.status);
  console.log('Generated AI Answer for Image:', res4.tokens.trim());

  console.log('\n=== TEST 5: Live HF Trending Model (BLIP) via /api/chat/stream ===');
  const blipPayload = JSON.stringify({
    modelId: 'Salesforce/blip-image-captioning-large',
    conversationId: 'test-conv-blip-' + Date.now(),
    messages: [
      {
        role: 'user',
        content: 'Describe what you see in this image.',
        attachments: [
          {
            name: 'test_red.jpg',
            type: 'image/jpeg',
            dataUrl: 'data:image/jpeg;base64,' + realImageBase64
          }
        ]
      }
    ]
  });

  const res5 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/chat/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(blipPayload)
      }
    }, (res) => {
      let tokens = '';
      res.on('data', chunk => {
        const lines = chunk.toString().split(/\r?\n/);
        for (const l of lines) {
          const trimmed = l.trim();
          if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
            try {
              const p = JSON.parse(trimmed.replace(/^data:\s*/, ''));
              if (p.content) tokens += p.content;
            } catch(e) {}
          }
        }
      });
      res.on('end', () => resolve({ status: res.statusCode, tokens }));
    });
    req.write(blipPayload);
    req.end();
  });
  console.log('Status:', res5.status);
  console.log('BLIP Generated Caption:', res5.tokens.trim());

  console.log('\n=== TEST 6: Model Hub Vision Endpoint /api/hub/vision/analyze ===');
  const hubBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const hubHead = '--' + hubBoundary + crlf +
    'Content-Disposition: form-data; name="prompt"' + crlf + crlf + 'What color is this image?' + crlf +
    '--' + hubBoundary + crlf +
    'Content-Disposition: form-data; name="modelId"' + crlf + crlf + 'gemini-2.5-flash-vision' + crlf +
    '--' + hubBoundary + crlf +
    'Content-Disposition: form-data; name="file"; filename="test_red.jpg"' + crlf +
    'Content-Type: image/jpeg' + crlf + crlf;
  const hubTail = crlf + '--' + hubBoundary + '--' + crlf;
  const hubMultipart = Buffer.concat([Buffer.from(hubHead, 'utf8'), realImageBuffer, Buffer.from(hubTail, 'utf8')]);

  const res6 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/hub/vision/analyze',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + hubBoundary,
        'Content-Length': hubMultipart.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.write(hubMultipart);
    req.end();
  });
  console.log('Status:', res6.status);
  console.log('Hub Vision Result Status:', res6.body.status, 'Description:', res6.body.description?.trim(), 'Error:', res6.body.error);

  console.log('\n=== TEST 7: Unsupported Model Verification (Florence-2) ===');
  const florenceHead = '--' + hubBoundary + crlf +
    'Content-Disposition: form-data; name="prompt"' + crlf + crlf + 'Describe' + crlf +
    '--' + hubBoundary + crlf +
    'Content-Disposition: form-data; name="modelId"' + crlf + crlf + 'microsoft/Florence-2-base' + crlf +
    '--' + hubBoundary + crlf +
    'Content-Disposition: form-data; name="file"; filename="test_red.jpg"' + crlf +
    'Content-Type: image/jpeg' + crlf + crlf;
  const florenceMultipart = Buffer.concat([Buffer.from(florenceHead, 'utf8'), realImageBuffer, Buffer.from(hubTail, 'utf8')]);
  const res7 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/hub/vision/analyze',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + hubBoundary,
        'Content-Length': florenceMultipart.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.write(florenceMultipart);
    req.end();
  });
  console.log('Status:', res7.status);
  console.log('Florence Response Status:', res7.body.status, 'Error Reason:', res7.body.error);
}

runTests();
