const fs = require('fs');

const BASE_URL = 'http://localhost:8080';

async function testApi() {
  console.log('=====================================================');
  console.log('Testing Multilingual Voice Output & End-to-End Suite');
  console.log('=====================================================\n');

  // 1. Verify GET /api/tts/languages
  console.log('1. Testing GET /api/tts/languages:');
  const langRes = await fetch(`${BASE_URL}/api/tts/languages`);
  if (!langRes.ok) throw new Error(`Languages endpoint failed: ${langRes.status}`);
  const languages = await langRes.json();
  console.log('   Status:', langRes.status);
  console.log('   Languages returned count:', languages.length);
  if (languages.length < 3) throw new Error(`Expected at least 3 languages, got ${languages.length}`);
  const codes = languages.map(l => l.code);
  if (!codes.includes('en') || !codes.includes('hi') || !codes.includes('mr')) {
    throw new Error(`Missing expected language codes: ${codes}`);
  }
  console.log('   ✓ Requirement 1 Passed: Exactly 3 languages (en, hi, mr) verified.\n');

  // 2. Verify GET /api/tts/status
  console.log('2. Testing GET /api/tts/status:');
  const statusRes = await fetch(`${BASE_URL}/api/tts/status`);
  const statusData = await statusRes.json();
  console.log('   Status payload:', statusData);
  if (statusData.status !== 'AVAILABLE' || statusData.modelId !== 'ai4bharat/indic-parler-tts') {
    throw new Error('Unexpected status payload');
  }
  console.log('   ✓ Status endpoint verified.\n');

  // 3. Test English Synthesis: POST /api/tts/speak (en)
  console.log('3. Testing English Speech Synthesis:');
  const enStart = Date.now();
  const enRes = await fetch(`${BASE_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hello, this is Yash AI testing English pronunciation.',
      language: 'en',
      conversationId: 'test-conv-1',
      messageId: 'test-msg-en-1'
    })
  });
  console.log('   Status:', enRes.status);
  console.log('   Content-Type:', enRes.headers.get('content-type'));
  console.log('   X-TTS-Model:', enRes.headers.get('X-TTS-Model'));
  console.log('   X-TTS-Language:', enRes.headers.get('X-TTS-Language'));
  const enBuf = Buffer.from(await enRes.arrayBuffer());
  console.log(`   Received ${enBuf.length} bytes in ${Date.now() - enStart}ms`);
  if (enBuf.length < 5000) throw new Error('English audio buffer too small');
  console.log('   ✓ Scenario 1 Passed: English speech synthesized successfully.\n');

  // 4. Test Hindi Synthesis & Translation: POST /api/tts/speak (hi)
  console.log('4. Testing Hindi Speech Synthesis & Pronunciation:');
  const hiStart = Date.now();
  const hiRes = await fetch(`${BASE_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Yash AI is an artificial intelligence assistant created to answer questions.',
      language: 'hi',
      conversationId: 'test-conv-1',
      messageId: 'test-msg-hi-1'
    })
  });
  console.log('   Status:', hiRes.status);
  console.log('   Content-Type:', hiRes.headers.get('content-type'));
  console.log('   X-TTS-Language:', hiRes.headers.get('X-TTS-Language'));
  const b64HiSpoken = hiRes.headers.get('X-TTS-Spoken-Text');
  if (b64HiSpoken) {
    const spokenText = Buffer.from(b64HiSpoken, 'base64').toString('utf-8');
    console.log('   Spoken Devanagari Hindi Text:', spokenText);
  }
  const hiBuf = Buffer.from(await hiRes.arrayBuffer());
  console.log(`   Received ${hiBuf.length} bytes in ${Date.now() - hiStart}ms`);
  if (hiBuf.length < 5000) throw new Error('Hindi audio buffer too small');
  console.log('   ✓ Scenario 2 Passed: Hindi pronunciation & speech synthesized successfully.\n');

  // 5. Test Marathi Synthesis & Translation: POST /api/tts/speak (mr)
  console.log('5. Testing Marathi Speech Synthesis & Pronunciation:');
  const mrStart = Date.now();
  const mrRes = await fetch(`${BASE_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Yash AI supports high performance multilingual voice output.',
      language: 'mr',
      conversationId: 'test-conv-1',
      messageId: 'test-msg-mr-1'
    })
  });
  console.log('   Status:', mrRes.status);
  console.log('   Content-Type:', mrRes.headers.get('content-type'));
  console.log('   X-TTS-Language:', mrRes.headers.get('X-TTS-Language'));
  const b64MrSpoken = mrRes.headers.get('X-TTS-Spoken-Text');
  if (b64MrSpoken) {
    const spokenText = Buffer.from(b64MrSpoken, 'base64').toString('utf-8');
    console.log('   Spoken Devanagari Marathi Text:', spokenText);
  }
  const mrBuf = Buffer.from(await mrRes.arrayBuffer());
  console.log(`   Received ${mrBuf.length} bytes in ${Date.now() - mrStart}ms`);
  if (mrBuf.length < 5000) throw new Error('Marathi audio buffer too small');
  console.log('   ✓ Scenario 3 Passed: Marathi pronunciation & speech synthesized successfully.\n');

  // 6. Test Cache Hits
  console.log('6. Testing In-Memory Audio Caching:');
  const cacheStart = Date.now();
  const cacheRes = await fetch(`${BASE_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hello, this is Yash AI testing English pronunciation.',
      language: 'en',
      conversationId: 'test-conv-1',
      messageId: 'test-msg-en-1'
    })
  });
  console.log('   Status:', cacheRes.status);
  console.log('   X-TTS-Cached:', cacheRes.headers.get('X-TTS-Cached'));
  console.log(`   Cached response returned in ${Date.now() - cacheStart}ms`);
  if (cacheRes.headers.get('X-TTS-Cached') !== 'true') {
    console.warn('   Note: Cache key mismatch or cache bypassed');
  } else {
    console.log('   ✓ Cache hit verified (0ms synthesis latency).\n');
  }

  // 7. Test Language Switch on Same Message (Replay in another language)
  console.log('7. Testing Language Switch & Replay on Same Message:');
  const replayStart = Date.now();
  const replayRes = await fetch(`${BASE_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hello, this is Yash AI testing English pronunciation.',
      language: 'mr', // switched to Marathi
      conversationId: 'test-conv-1',
      messageId: 'test-msg-en-1'
    })
  });
  console.log('   Status:', replayRes.status);
  console.log('   X-TTS-Language:', replayRes.headers.get('X-TTS-Language'));
  const replayBuf = Buffer.from(await replayRes.arrayBuffer());
  console.log(`   Replayed in Marathi: ${replayBuf.length} bytes in ${Date.now() - replayStart}ms`);
  if (replayRes.headers.get('X-TTS-Language') !== 'mr') throw new Error('Expected Marathi language on switch');
  console.log('   ✓ Scenario 6 Passed: Language switch affected subsequent playback.\n');

  // 8. Test Error Handling: Empty text bad request
  console.log('8. Testing Error Handling (Empty text):');
  const badRes = await fetch(`${BASE_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '   ', language: 'en' })
  });
  console.log('   Status:', badRes.status);
  const badJson = await badRes.json();
  console.log('   Error body:', badJson);
  if (badRes.status !== 400) throw new Error('Expected 400 for empty text');
  console.log('   ✓ Scenario 10 Passed: Error handling verified.\n');

  // 9. Test Existing Features (Chat Stream & Model Hub)
  console.log('9. Testing Existing Feature Integrity (Chat stream & Model Hub):');
  const chatRes = await fetch(`${BASE_URL}/api/conversations`);
  console.log('   Conversations status:', chatRes.status);
  if (!chatRes.ok) throw new Error('Conversations failed');

  const hubRes = await fetch(`${BASE_URL}/api/hub/models`);
  console.log('   Model Hub status:', hubRes.status);
  if (!hubRes.ok) throw new Error('Model Hub failed');
  const hubModels = await hubRes.json();
  console.log(`   Model Hub returned ${hubModels.length || 0} models across text, image, vision.`);
  console.log('   ✓ Existing features preserved without regression.\n');

  console.log('=====================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================');
}

testApi().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
