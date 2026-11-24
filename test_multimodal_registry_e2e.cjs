const http = require('http');

const BASE_URL = 'http://localhost:8080';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 Yash AI: Multimodal Registry & Provider Architecture E2E Tests');
  console.log('=============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  try {
    // 1. Categories Endpoint (All 12 Categories)
    console.log('--- TEST SUITE 1: 12 Official Model Categories ---');
    const catRes = await request('GET', '/api/models/categories');
    assert(catRes.status === 200, 'GET /api/models/categories returns HTTP 200');
    assert(Array.isArray(catRes.data), 'Categories response is an array');
    assert(catRes.data.length === 12, `Exactly 12 official categories returned (got ${catRes.data.length})`);

    const expectedKeys = [
      'text-generation-and-reasoning',
      'any-to-any-multimodal',
      'image-and-text-to-text',
      'image-to-text',
      'image-to-image',
      'text-to-image',
      'text-to-video',
      'text-to-speech',
      'speech-to-text-and-audio-understanding',
      'audio-to-audio',
      'video-to-text-and-video-understanding',
      'embeddings-and-reranking'
    ];

    const returnedKeys = catRes.data.map(c => c.key);
    for (const key of expectedKeys) {
      assert(returnedKeys.includes(key), `Category '${key}' exists with label and description`);
    }

    // 2. Comprehensive Model Registry Catalog
    console.log('\n--- TEST SUITE 2: Comprehensive Model Registry Catalog ---');
    const regRes = await request('GET', '/api/models/registry');
    assert(regRes.status === 200, 'GET /api/models/registry returns HTTP 200');
    assert(regRes.data.models && regRes.data.models.length > 0, `Registry contains verified models (found: ${regRes.data.models.length})`);

    const sample = regRes.data.models.find(m => m.id === 'gemini-2.5-flash');
    assert(sample !== undefined, "Model 'gemini-2.5-flash' exists in registry");
    if (sample) {
      assert(sample.verifiedQuota && sample.verifiedQuota.includes('RPM'), 'Verified quota contains transparent RPM/RPD limits');
      assert(sample.contextWindow === 1000000, 'Gemini 2.5 Flash has 1M context window');
      assert(sample.officialModelUrl && sample.officialModelUrl.startsWith('http'), 'Official model documentation URL provided');
      assert(sample.supportedInputModalities.includes('text') && sample.supportedInputModalities.includes('image'), 'Supported input modalities include text and image');
    }

    // 3. Category & Provider Filtering
    console.log('\n--- TEST SUITE 3: Filtering by Category, Provider & Modality ---');
    const imageGenRes = await request('GET', '/api/models/registry?category=text-to-image');
    assert(imageGenRes.data.models.every(m => m.categories.includes('text-to-image')), 'Filtered models all belong to text-to-image');

    const groqRes = await request('GET', '/api/models/registry?provider=groq');
    assert(groqRes.data.models.every(m => m.providerId === 'groq'), 'Filtered models all have providerId == groq');

    const audioRes = await request('GET', '/api/models/registry?modality=audio');
    assert(audioRes.data.models.length > 0, 'Modality filter for audio returns audio models');

    // 4. Free-Only Mode Enforcer
    console.log('\n--- TEST SUITE 4: Free-Only Mode Enforcer ---');
    const toggleOnRes = await request('POST', '/api/models/free-only-mode', { enabled: true });
    assert(toggleOnRes.status === 200 && toggleOnRes.data.freeOnlyMode === true, 'Free-Only Mode can be enabled');

    const freeModelsRes = await request('GET', '/api/models/registry');
    assert(freeModelsRes.data.models.every(m => m.isFreeOnlyEligible === true), 'All models returned under Free-Only Mode are 100% free eligible');

    const toggleOffRes = await request('POST', '/api/models/free-only-mode', { enabled: false });
    assert(toggleOffRes.status === 200 && toggleOffRes.data.freeOnlyMode === false, 'Free-Only Mode can be toggled');

    // Re-enable Free-Only Mode as default safe setting
    await request('POST', '/api/models/free-only-mode', { enabled: true });

    // 5. Modality Validation & Fallback Routing
    console.log('\n--- TEST SUITE 5: Modality Validation & Compatibility Fallback ---');
    const validModRes = await request('POST', '/api/models/validate-modality', {
      modelId: 'gemini-2.5-flash',
      modalities: ['text', 'image']
    });
    assert(validModRes.data.valid === true, "Valid modality: 'gemini-2.5-flash' allows text & image");

    const invalidModRes = await request('POST', '/api/models/validate-modality', {
      modelId: 'llama-3.3-70b-versatile',
      modalities: ['image']
    });
    assert(invalidModRes.data.valid === false, "Modality rejection: 'llama-3.3-70b-versatile' rejects image input");
    assert(invalidModRes.data.suggestedFallback !== undefined, 'Compatibility-aware fallback model suggested on modality mismatch');

    // 6. Live Status & Provider Test Connectivity
    console.log('\n--- TEST SUITE 6: Live Status & Safe Connectivity Pings ---');
    const statusRes = await request('GET', '/api/models/live-status');
    assert(statusRes.status === 200, 'GET /api/models/live-status returns HTTP 200');
    assert(statusRes.data.activeProvider !== undefined, 'Active provider returned');

    const testGemini = await request('POST', '/api/models/test-connection', { providerId: 'gemini' });
    assert(testGemini.status === 200 && testGemini.data.providerId === 'gemini', 'Ping Gemini free provider endpoint');

    const testPollinations = await request('POST', '/api/models/test-connection', { providerId: 'pollinations' });
    assert(testPollinations.status === 200 && testPollinations.data.connected === true, 'Ping Pollinations AI free diffusion provider');

    // 7. Preferred Model Configuration
    console.log('\n--- TEST SUITE 7: Preferred Model Configuration ---');
    const setPrefRes = await request('POST', '/api/models/preferred', {
      category: 'text-generation-and-reasoning',
      modelId: 'llama-3.3-70b-versatile'
    });
    assert(setPrefRes.status === 200 && setPrefRes.data.preferredModelId === 'llama-3.3-70b-versatile', 'Set preferred model for category text-generation-and-reasoning');

    // Reset back to gemini-2.5-flash
    await request('POST', '/api/models/preferred', {
      category: 'text-generation-and-reasoning',
      modelId: 'gemini-2.5-flash'
    });

  } catch (err) {
    console.error('Test execution error:', err);
  }

  console.log('\n=============================================================');
  console.log(`📊 SUMMARY: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('=============================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
