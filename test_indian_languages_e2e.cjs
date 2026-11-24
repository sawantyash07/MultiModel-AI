/**
 * End-to-End Verification Suite for Indian-Language Text Reading & Native Voice Output
 * Yash AI (React + Spring Boot)
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let json = null;
        if (contentType.includes('application/json')) {
          try {
            json = JSON.parse(buffer.toString('utf8'));
          } catch (_) {}
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer,
          text: buffer.toString('utf8'),
          json
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForServer(maxAttempts = 30, intervalMs = 2000) {
  process.stdout.write('Waiting for Yash AI backend at ' + BASE_URL + ' ...');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await makeRequest('GET', '/api/models');
      if (res.status === 200) {
        console.log(' CONNECTED (HTTP ' + res.status + ')');
        return true;
      }
    } catch (_) {}
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, intervalMs));
  }
  console.log(' FAILED to connect after ' + (maxAttempts * intervalMs / 1000) + 's');
  return false;
}

async function runTests() {
  console.log('\n===============================================================');
  console.log(' 🌐 YASH AI: INDIAN-LANGUAGE TEXT & NATIVE VOICE E2E TEST SUITE ');
  console.log('===============================================================\n');

  const ready = await waitForServer();
  if (!ready) {
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${extra}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${name} ${extra}`);
      failed++;
    }
  }

  // --- Test Suite 1: Central Language Registry ---
  console.log('\n--- 1. Central Language-to-Model Registry Verification ---');
  try {
    const res = await makeRequest('GET', '/api/tts/languages');
    assert('HTTP status is 200', res.status === 200);

    const langs = Array.isArray(res.json) ? res.json : res.json?.languages || [];
    assert('Total 23 languages registered (English + 22 Scheduled)', langs.length === 23, `(Got ${langs.length})`);

    const prodLangs = langs.filter(l => l.status === 'production');
    const prevLangs = langs.filter(l => l.status === 'preview');
    assert('At least 12 production languages with verified engines', prodLangs.length >= 12, `(Got ${prodLangs.length} production)`);
    assert('Honest preview classification for preview languages', prevLangs.length >= 10, `(Got ${prevLangs.length} preview)`);

    // Verify key languages presence & voice metadata
    const testKeys = ['en', 'hi', 'mr', 'bn', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'ur', 'ne', 'as', 'sa'];
    for (const code of testKeys) {
      const lang = langs.find(l => l.code === code);
      assert(`Language entry '${code}' present`, Boolean(lang), `(name: ${lang?.name}, script: ${lang?.script}, status: ${lang?.status})`);
      if (lang) {
        assert(`Language '${code}' has voice options`, Array.isArray(lang.voices) && lang.voices.length > 0, `(${lang.voices.length} voices)`);
      }
    }
  } catch (err) {
    assert('Registry request failed', false, err.message);
  }

  // --- Test Suite 2: Real Multilingual Speech Synthesis ---
  console.log('\n--- 2. Production Neural Speech Synthesis for Verified Languages ---');
  const speechTests = [
    { lang: 'en', name: 'English', text: 'Welcome to Yash AI. Multilingual intelligent voice synthesis is now active.' },
    { lang: 'hi', name: 'Hindi', text: 'यश एआई में आपका स्वागत है। हिंदी में उच्च सटीकता वाली ध्वनि उपलब्ध है।' },
    { lang: 'mr', name: 'Marathi', text: 'यश एआय मध्ये आपले स्वागत आहे. मराठी भाषेतील ऑडिओ यशस्वीरीत्या तयार झाला आहे.' },
    { lang: 'bn', name: 'Bengali', text: 'ইয়াশ এআই-তে আপনাকে স্বাগতম। বাংলা ভয়েস সফলভাবে সংশ্লেষিত হয়েছে।' },
    { lang: 'gu', name: 'Gujarati', text: 'યશ એઆઈ માં આપનું સ્વાગત છે. ગુજરાતી ભાષામાં ઓડિયો તૈયાર છે.' },
    { lang: 'ta', name: 'Tamil', text: 'யாஷ் ஏஐ-க்கு வரவேற்கிறோம். தமிழ் குரல் வெற்றிகரமாக உருவாக்கப்பட்டது.' },
    { lang: 'te', name: 'Telugu', text: 'యాష్ ఏఐ కి స్వాगతం. తెలుగు వాయిస్ విజయవంతంగా ఉత్పత్తి చేయబడింది.' },
    { lang: 'kn', name: 'Kannada', text: 'ಯಶ್ ಎಐ ಗೆ ಸುಸ್ವಾಗತ. ಕನ್ನಡ ಧ್ವನಿ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ.' },
    { lang: 'ml', name: 'Malayalam', text: 'യാഷ് എഐ-ലേക്ക് സ്വാഗതം. മലയാളം ശബ്ദം വിജയകരമായി സൃഷ്ടിച്ചു.' },
    { lang: 'pa', name: 'Punjabi', text: 'ਯਸ਼ ਏਆਈ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਪੰਜਾਬੀ ਆਵਾਜ਼ ਤਿਆਰ ਹੈ।' },
    { lang: 'ur', name: 'Urdu', text: 'یش اے آئی میں خوش آمدید۔ اردو آواز تیار ہے۔' },
    { lang: 'ne', name: 'Nepali', text: 'यश एआई मा स्वागत छ। नेपाली आवाज तयार छ।' }
  ];

  for (const item of speechTests) {
    try {
      const startTime = Date.now();
      const res = await makeRequest('POST', '/api/tts/speak', {
        text: item.text,
        language: item.lang,
        conversationId: 'test-e2e-conv',
        messageId: `test-msg-${item.lang}`
      }, {
        'Accept': 'application/json'
      });
      const latency = Date.now() - startTime;

      assert(`Synthesis HTTP 200 for ${item.name} (${item.lang})`, res.status === 200);
      assert(`JSON status is success for ${item.name}`, res.json?.status === 'success');
      assert(`Audio content-type is audio/mpeg for ${item.name}`, res.json?.contentType === 'audio/mpeg');

      const audioLen = res.json?.audioBase64 ? Buffer.from(res.json.audioBase64, 'base64').length : 0;
      assert(`Audio bytes > 1000 for ${item.name}`, audioLen > 1000, `(${audioLen} bytes, ${latency}ms latency)`);
      assert(`Word timestamps present for ${item.name}`, Array.isArray(res.json?.timestamps) && res.json.timestamps.length > 0, `(${res.json?.timestamps?.length} words)`);
    } catch (err) {
      assert(`Speech synthesis for ${item.name} failed`, false, err.message);
    }
  }

  // --- Test Suite 2b: Direct Binary Audio Stream (audio/mpeg) ---
  console.log('\n--- 2b. Direct Binary Audio Streaming Verification ---');
  try {
    const res = await makeRequest('POST', '/api/tts/speak', {
      text: 'Direct binary streaming test in Marathi.',
      language: 'mr',
      conversationId: 'test-stream-conv',
      messageId: 'test-stream-msg'
    }, {
      'Accept': 'audio/mpeg'
    });

    assert('Binary stream HTTP 200', res.status === 200);
    assert('Binary Content-Type is audio/mpeg', res.headers['content-type']?.includes('audio/mpeg'), `(${res.headers['content-type']})`);
    assert('Binary audio bytes > 1000', res.buffer.length > 1000, `(${res.buffer.length} bytes)`);
    assert('Response contains X-TTS-Language header', res.headers['x-tts-language'] === 'mr');
    assert('Response contains X-TTS-Provider header', Boolean(res.headers['x-tts-provider']));
  } catch (err) {
    assert('Binary stream test failed', false, err.message);
  }

  // --- Test Suite 3: Multi-Factor Isolated Audio Cache Verification ---
  console.log('\n--- 3. Multi-Factor Audio Cache Isolation Verification ---');
  try {
    const text = 'नमस्ते, यह कैश परीक्षण संदेश है।';
    const convId = 'test-cache-conv';
    const msgId = 'test-cache-msg';

    // 1st call: Miss (generates & caches)
    const t1 = Date.now();
    const res1 = await makeRequest('POST', '/api/tts/speak', {
      text,
      language: 'hi',
      voice: 'default',
      conversationId: convId,
      messageId: msgId
    });
    const dur1 = Date.now() - t1;

    // 2nd call: Exact match (instant cache hit)
    const t2 = Date.now();
    const res2 = await makeRequest('POST', '/api/tts/speak', {
      text,
      language: 'hi',
      voice: 'default',
      conversationId: convId,
      messageId: msgId
    });
    const dur2 = Date.now() - t2;

    assert('Cache Hit serves matching status 200', res2.status === 200);
    assert('Cache Hit serves identical audioBase64', res1.json?.audioBase64 === res2.json?.audioBase64 && Boolean(res1.json?.audioBase64));
    assert('Cache Hit isCached flag is true', res2.json?.cached === true);
    assert('Cache Hit is significantly faster than first generation', dur2 < dur1 || dur2 < 100, `(Miss: ${dur1}ms, Hit: ${dur2}ms)`);
  } catch (err) {
    assert('Cache test failed', false, err.message);
  }

  // --- Test Suite 4: Pre-Synthesis Text Normalization & Sanitization ---
  console.log('\n--- 4. Pre-Synthesis Indian Text Normalization Verification ---');
  try {
    // Rich mixed content with currency, percentage, acronym, markdown table/code
    const richContent = `# शीर्षक\n\nयहाँ कीमत **₹500** है और छूट **20%** है।\n\n\`\`\`python\nprint("Ignored in speech")\n\`\`\`\n\nहमारी वेबसाइट [Yash AI](https://yash.ai) पर जाएँ। API और AI बहुत उपयोगी हैं।`;

    const res = await makeRequest('POST', '/api/tts/speak', {
      text: richContent,
      language: 'hi',
      conversationId: 'test-norm-conv',
      messageId: 'test-norm-msg'
    });

    assert('Normalized speech request succeeds HTTP 200', res.status === 200);
    const audioLen = res.json?.audioBase64 ? Buffer.from(res.json.audioBase64, 'base64').length : 0;
    assert('Normalized audio stream contains valid audio bytes', audioLen > 2000, `(${audioLen} bytes)`);

    // Verify spoken text was normalized
    const spoken = res.json?.spokenText || '';
    assert('Spoken text does not contain raw Markdown triple backticks', !spoken.includes('```'));
    assert('Spoken text expanded currency (रुपये)', spoken.includes('रुपये'));
    assert('Spoken text expanded percentage (प्रतिशत)', spoken.includes('प्रतिशत'));
  } catch (err) {
    assert('Normalization test failed', false, err.message);
  }

  // --- Test Suite 5: Honest Preview Tier & Fallback Handling ---
  console.log('\n--- 5. Honest Preview Tier Limitation Verification ---');
  try {
    // Sanskrit (sa) is in preview tier and not supported by Google Hosted engine
    const res = await makeRequest('POST', '/api/tts/speak', {
      text: 'सर्वे भवन्तु सुखिनः सर्वे सन्तु निरामयाः।',
      language: 'sa',
      conversationId: 'test-preview-conv',
      messageId: 'test-preview-msg'
    });

    assert('Preview language without credentials truthfully returns HTTP 501', res.status === 501, `(Status: ${res.status})`);
    assert('Preview response does NOT silently substitute English audio', res.json?.status === 'preview_limitation');
    if (res.json) {
      assert('Preview error details describe required credentials honestly',
        res.json.error?.toLowerCase().includes('preview') || res.json.error?.toLowerCase().includes('credential'),
        `("${res.json.error}")`);
    }
  } catch (err) {
    assert('Preview limitation test failed', false, err.message);
  }

  console.log('\n===============================================================');
  console.log(` 🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (${passed + failed} TOTAL)`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
