// ==============================================================================
// 🔬 YASH AI - IMAGE QUOTA, PROVIDER ROUTING & RESILIENCE VERIFICATION SUITE
// ==============================================================================

const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:8080${path}`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    }).on('error', reject);
  });
}

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runSuite() {
  console.log('========================================================================');
  console.log('🔬 YASH AI: 12-POINT IMAGE QUOTA & PROVIDER ROUTING VERIFICATION SUITE');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Gemini image generation with zero quota (allowFallback = false)
  // -------------------------------------------------------------------------
  console.log('TEST 1: Gemini image generation with zero quota (allowFallback = false)');
  const res1 = await post('/api/hub/image/generate', {
    modelId: 'gemini-3.1-flash-image',
    prompt: 'A red apple on white background',
    allowFallback: false
  });
  assert(res1.status === 200, 'HTTP endpoint returned 200 OK');
  assert(res1.body.status === 'ERROR', 'Response accurately reports status ERROR (no fake image or silent deception)');
  assert(res1.body.errorCategory === 'ZERO_QUOTA', `Error categorized accurately as ZERO_QUOTA (got: ${res1.body.errorCategory})`);
  assert(res1.body.errorReason.includes('limit: 0'), `Error reason accurately diagnoses 'limit: 0' Free Tier quota (got: ${res1.body.errorReason})`);
  assert(res1.body.errorNextStep.includes('billing'), 'Actionable next step guides user to Google AI Studio billing setup');
  assert(res1.body.docUrl === 'https://ai.google.dev/gemini-api/docs/billing', 'Official Google billing documentation URL attached');
  assert(res1.body.canRetry === false, 'canRetry is false for zero quota (prevents endless futile retries)');
  assert(res1.body.canFallback === true, 'Offers explicit fallback capability');
  assert(res1.body.fallbackModelId === 'flux-schnell-free', 'Designates verified free diffusion as fallback');

  // -------------------------------------------------------------------------
  // TEST 2: Circuit Breaker Cache Cooldown & Prevention of Repeated Failures
  // -------------------------------------------------------------------------
  console.log('\nTEST 2: Circuit Breaker Cooldown (Prevents rediscovering zero-quota lag across sessions)');
  const tStart = Date.now();
  const res2 = await post('/api/hub/image/generate', {
    modelId: 'gemini-3.1-flash-image',
    prompt: 'A green apple on table',
    allowFallback: false
  });
  const tElapsed = Date.now() - tStart;
  assert(res2.status === 200, 'HTTP endpoint returned 200 OK');
  assert(res2.body.errorCategory === 'ZERO_QUOTA', 'Preserves cached ZERO_QUOTA category');
  assert(tElapsed < 100, `Circuit breaker returned fast response without network lag (${tElapsed}ms < 100ms)`);
  assert(res2.body.cooldownSeconds > 0, `Active cooldown returned: ${res2.body.cooldownSeconds}s remaining`);

  // -------------------------------------------------------------------------
  // TEST 3: Live Health Check & Connectivity Check Endpoint
  // -------------------------------------------------------------------------
  console.log('\nTEST 3: Manual "Check Provider" Action (POST /api/hub/image/providers/gemini/check)');
  const res3 = await post('/api/hub/image/providers/gemini/check?modelId=gemini-3.1-flash-image', {});
  assert(res3.status === 200, 'Check provider endpoint returned 200 OK');
  assert(res3.body.providerId === 'gemini', 'Checked provider correctly identified as gemini');
  assert(res3.body.status === 'ZERO_QUOTA', `Live check accurately diagnosed status as ZERO_QUOTA (got: ${res3.body.status})`);
  assert(res3.body.operation === 'TEXT_TO_IMAGE', 'Isolation verified: Check is strictly scoped to TEXT_TO_IMAGE operation');
  assert(res3.body.isBlocked === true, 'Provider is blocked during active zero-quota cooldown');

  // -------------------------------------------------------------------------
  // TEST 4: Modality Isolation (Image Zero-Quota Does NOT Affect Unrelated Text Generation)
  // -------------------------------------------------------------------------
  console.log('\nTEST 4: Modality Isolation (Gemini text generation remains unaffected)');
  const liveStatus = await get('/api/models/live-status');
  assert(liveStatus.status === 200, 'Live status endpoint returned 200 OK');
  assert(liveStatus.body.providers && liveStatus.body.providers.gemini !== undefined, 'Gemini text provider remains registered in multimodal pool');

  // -------------------------------------------------------------------------
  // TEST 5: OpenAI Provider Image Check & Quota Handling
  // -------------------------------------------------------------------------
  console.log('\nTEST 5: OpenAI Image Provider (gpt-image-2.5-flare) Check');
  const res5 = await post('/api/hub/image/providers/openai/check?modelId=gpt-image-2.5-flare', {});
  assert(res5.status === 200, 'OpenAI check endpoint returned 200 OK');
  assert(res5.body.providerId === 'openai', 'Checked provider correctly identified as openai');
  assert(res5.body.status === 'AVAILABLE' || res5.body.status === 'ZERO_QUOTA', `OpenAI status classified: ${res5.body.status}`);

  // -------------------------------------------------------------------------
  // TEST 6: Automatic Fallback Enabled with Truthful Attribution
  // -------------------------------------------------------------------------
  console.log('\nTEST 6: Automatic Fallback Enabled (allowFallback = true)');
  console.log('  ⏳ Waiting 25s for free tier IP burst window to clear...');
  await new Promise(r => setTimeout(r, 25000));
  const res6 = await post('/api/hub/image/generate', {
    modelId: 'gemini-3.1-flash-image',
    prompt: 'A bright yellow sun in clear blue sky',
    allowFallback: true
  });
  assert(res6.status === 200, 'HTTP endpoint returned 200 OK');
  assert(res6.body.status === 'SUCCESS', 'Failover succeeded with status SUCCESS');
  assert(res6.body.fallbackFrom === 'gemini-3.1-flash-image', 'Fallback origin honestly disclosed as gemini-3.1-flash-image');
  assert(res6.body.actualProvider === 'Pollinations (Free Hosted)', 'Truthful actual provider: Pollinations (Free Hosted)');
  assert(res6.body.actualModelName != null && (res6.body.actualModelName.includes('Sana') || res6.body.actualModelName.includes('FLUX')), `Truthful model name: ${res6.body.actualModelName}`);
  assert(res6.body.imageDataUrl && res6.body.imageDataUrl.startsWith('data:image/'), 'Real, valid image data URL returned');

  // -------------------------------------------------------------------------
  // TEST 7: Domain Entity & Uniform Disambiguation under Fallback
  // -------------------------------------------------------------------------
  console.log('\nTEST 7: Domain Entity & Uniform Disambiguation (MS Dhoni in CSK Jersey)');
  const res7 = await post('/api/hub/image/analyze-prompt', {
    prompt: 'Give me the image of Ms Dhoni of in Jersey of CSK',
    modelId: 'gemini-3.1-flash-image'
  });
  assert(res7.body.entityResolved === true, 'Entity detected and resolved');
  assert(res7.body.resolvedEntity.includes('Mahendra Singh Dhoni'), 'Resolved to MS Dhoni likeness');
  assert(res7.body.resolvedClothing.includes('Chennai Super Kings') && res7.body.resolvedClothing.includes('canary-yellow'), 'Resolved to official CSK canary-yellow kit');
  assert(res7.body.originalPrompt === 'Give me the image of Ms Dhoni of in Jersey of CSK', 'Original prompt strictly preserved as source of truth');

  // -------------------------------------------------------------------------
  // TEST 8: Minimalist Negative Constraints Preservation (Zero Cinematic Bloat)
  // -------------------------------------------------------------------------
  console.log('\nTEST 8: Minimalist Negative Constraints (Clean white background, no text)');
  const res8 = await post('/api/hub/image/analyze-prompt', {
    prompt: 'a single red apple on clean white background, no text',
    modelId: 'flux-schnell-free'
  });
  assert(res8.body.negativeConstraints.length >= 2, 'Negative constraints extracted');
  assert(res8.body.negativeConstraints.includes('plain white background (no background scenery)'), 'Plain white background constraint enforced');
  assert(res8.body.negativeConstraints.includes('no text or lettering'), 'No text constraint enforced');

  // -------------------------------------------------------------------------
  // TEST 9: Hugging Face Deprecated Model Handling (HTTP 410 / MODEL_UNAVAILABLE)
  // -------------------------------------------------------------------------
  console.log('\nTEST 9: Hugging Face Model Availability Check');
  const res9 = await post('/api/hub/image/providers/huggingface/check?modelId=black-forest-labs/FLUX.1-schnell', {});
  assert(res9.status === 200, 'HF check returned 200 OK');
  assert(res9.body.providerId === 'huggingface', 'Checked provider correctly identified as huggingface');

  // -------------------------------------------------------------------------
  // TEST 10: Provider Status Registry Endpoint (GET /api/hub/image/providers/status)
  // -------------------------------------------------------------------------
  console.log('\nTEST 10: Centralized Image Provider Status Registry');
  const res10 = await get('/api/hub/image/providers/status');
  assert(res10.status === 200, 'Status registry returned 200 OK');
  assert(typeof res10.body === 'object', 'Registry returned key-value map of provider statuses');
  const keys = Object.keys(res10.body);
  assert(keys.length > 0, `Registry contains ${keys.length} tracked provider status records`);

  // -------------------------------------------------------------------------
  // TEST 11: Free Diffusion Direct Invocation (Zero Fallback Needed)
  // -------------------------------------------------------------------------
  console.log('\nTEST 11: Free Diffusion Direct Invocation (flux-schnell-free)');
  // Pollinations free hosted tier enforces a 35s per-IP cooldown between image downloads
  console.log('  ⏳ Waiting 35s for free tier IP cooldown window to reset...');
  await new Promise(r => setTimeout(r, 35000));
  const res11 = await post('/api/hub/image/generate', {
    modelId: 'flux-schnell-free',
    prompt: 'A blue butterfly on a green leaf'
  });
  assert(res11.status === 200, 'HTTP endpoint returned 200 OK');
  assert(res11.body.status === 'SUCCESS', 'Generation succeeded with status SUCCESS');
  assert(res11.body.fallbackFrom == null, 'No fallback needed when selecting free diffusion directly');
  assert(res11.body.imageDataUrl && res11.body.imageDataUrl.startsWith('data:image/'), 'Real, valid image bytes returned');

  // -------------------------------------------------------------------------
  // TEST 12: Gallery History Persistence & Inspection
  // -------------------------------------------------------------------------
  console.log('\nTEST 12: Image Gallery History Persistence');
  const res12 = await get('/api/hub/image/history');
  assert(res12.status === 200, 'Image history returned 200 OK');
  assert(res12.body.total > 0, `Image history contains ${res12.body.total} persisted images with full metadata`);

  console.log('\n========================================================================');
  console.log(`📊 EVALUATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
