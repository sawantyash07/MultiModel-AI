const http = require('http');

async function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🔬 YASH AI IMAGE ACCURACY & FIDELITY EVALUATION SUITE');
  console.log('========================================================================\n');

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

  // -------------------------------------------------------------------------
  // TEST CASE 1: Original User Prompt with gemini-3-pro-image (allowFallback = false)
  // MUST NOT silently fallback! Must return honest quota diagnosis with canFallback: true
  // -------------------------------------------------------------------------
  console.log('TEST 1: "Give me the image of Ms Dhoni of in Jersey of CSK" with gemini-3-pro-image (allowFallback = false)');
  try {
    const res1 = await postJson('/api/hub/image/generate', {
      modelId: 'gemini-3-pro-image',
      prompt: 'Give me the image of Ms Dhoni of in Jersey of CSK',
      allowFallback: false
    });

    assert(res1.status === 200, 'HTTP endpoint returned 200 OK');
    const d1 = res1.data;
    assert(d1.status === 'ERROR', 'Response accurately reports status ERROR (no silent deception)');
    assert(d1.errorCategory === 'QUOTA_EXCEEDED', 'Error category correctly classified as QUOTA_EXCEEDED');
    assert(d1.error.includes('HTTP 429') || d1.error.includes('quota') || d1.error.includes('billing'), 'Error message honestly discloses Google Gemini Free Tier limit 0 requirement');
    assert(d1.canFallback === true, 'Response offers explicit fallback capability (canFallback: true)');
    assert(d1.fallbackModelId === 'flux-schnell-free', 'Fallback model correctly designated as flux-schnell-free');
    assert(d1.actualModelId === 'gemini-3-pro-image', 'Actual model accurately identified as gemini-3-pro-image (no silent replacement)');

    // Verify Prompt Specification and Domain Entity Resolution
    const spec1 = d1.structuredSpec;
    assert(spec1 !== null && spec1 !== undefined, 'Structured prompt specification generated');
    assert(spec1.originalPrompt === 'Give me the image of Ms Dhoni of in Jersey of CSK', 'Original user prompt strictly preserved as source of truth');
    assert(spec1.entityResolved === true, 'Domain Entity Resolver successfully detected domain entity');
    assert(spec1.resolvedEntity.includes('Dhoni'), 'Entity successfully resolved to MS Dhoni: ' + spec1.resolvedEntity);
    assert(spec1.resolvedClothing.includes('Chennai Super Kings') && spec1.resolvedClothing.includes('yellow'), 'Jersey successfully resolved to official CSK canary-yellow uniform');
    assert(spec1.modelSpecificPrompt.includes('Dhoni') && spec1.modelSpecificPrompt.includes('Chennai Super Kings'), 'Model prompt synthesizes unambiguous visual description');
  } catch (err) {
    console.error('Test 1 failed with exception:', err.message);
  }

  console.log('\n------------------------------------------------------------------------');

  // -------------------------------------------------------------------------
  // TEST CASE 2: Original User Prompt with explicit fallback (allowFallback = true)
  // When user permits failover, verify fallback succeeds, model is truthfully attributed (Sana/FLUX), never mislabeled
  // -------------------------------------------------------------------------
  console.log('TEST 2: "Give me the image of Ms Dhoni of in Jersey of CSK" with allowFallback = true');
  try {
    const res2 = await postJson('/api/hub/image/generate', {
      modelId: 'gemini-3-pro-image',
      prompt: 'Give me the image of Ms Dhoni of in Jersey of CSK',
      allowFallback: true
    });

    const d2 = res2.data;
    if (d2.status === 'SUCCESS') {
      assert(d2.imageDataUrl && d2.imageDataUrl.startsWith('data:image/'), 'Valid image data URL generated');
      assert(d2.fallbackFrom === 'gemini-3-pro-image', 'Fallback origin honestly disclosed as gemini-3-pro-image');
      assert(d2.actualModelName !== 'gemini-3-pro-image', 'Truthful attribution: Never labels free diffusion as Gemini');
      console.log(`     -> Actual model used: ${d2.actualModelName} (${d2.actualProvider})`);
      console.log(`     -> Failover reason: ${d2.fallbackReason}`);
    } else {
      console.log('     -> Fallback response: ' + d2.status + ' (' + d2.error + ')');
    }
  } catch (err) {
    console.error('Test 2 failed with exception:', err.message);
  }

  console.log('\n------------------------------------------------------------------------');

  // -------------------------------------------------------------------------
  // TEST CASE 3: Virat Kohli in Team India Jersey (Entity + Jersey Resolution)
  // -------------------------------------------------------------------------
  console.log('TEST 3: "A portrait of Virat Kohli wearing Team India jersey"');
  try {
    const res3 = await postJson('/api/hub/image/analyze-prompt', {
      modelId: 'flux-schnell-free',
      prompt: 'A portrait of Virat Kohli wearing Team India jersey',
      enhancePrompt: true
    });

    const spec3 = res3.data;
    assert(spec3.entityResolved === true, 'Entity detected for Virat Kohli');
    assert(spec3.resolvedEntity.includes('Virat Kohli'), 'Entity resolved to Virat Kohli: ' + spec3.resolvedEntity);
    assert(spec3.resolvedClothing.includes('Team India') && spec3.resolvedClothing.includes('blue'), 'Jersey resolved to official Team India blue kit');
    assert(spec3.modelSpecificPrompt.includes('Virat Kohli') && spec3.modelSpecificPrompt.includes('Team India'), 'Model prompt contains visual Kohli + blue jersey description');
  } catch (err) {
    console.error('Test 3 failed with exception:', err.message);
  }

  console.log('\n------------------------------------------------------------------------');

  // -------------------------------------------------------------------------
  // TEST CASE 4: Negative Constraints & Minimalist Prompt ("no text, clean white background")
  // -------------------------------------------------------------------------
  console.log('TEST 4: "a single red apple on clean white background, no text"');
  try {
    const res4 = await postJson('/api/hub/image/analyze-prompt', {
      modelId: 'flux-schnell-free',
      prompt: 'a single red apple on clean white background, no text',
      enhancePrompt: false
    });

    const spec4 = res4.data;
    assert(spec4.isSimpleRequest === true, 'Correctly classified as minimalist simple request');
    assert(spec4.negativeConstraints.length >= 2, 'Extracted explicit negative constraints: ' + JSON.stringify(spec4.negativeConstraints));
    assert(spec4.originalPrompt === 'a single red apple on clean white background, no text', 'Original prompt strictly preserved');
    assert(spec4.modelSpecificPrompt === 'a single red apple on clean white background, no text', 'Zero unwanted cinematic bloat added for simple request');
  } catch (err) {
    console.error('Test 4 failed with exception:', err.message);
  }

  console.log('\n------------------------------------------------------------------------');

  // -------------------------------------------------------------------------
  // TEST CASE 5: Quantities and Spatial Count ("three gold coins stacked")
  // -------------------------------------------------------------------------
  console.log('TEST 5: "three gold coins stacked on a dark wooden table"');
  try {
    const res5 = await postJson('/api/hub/image/analyze-prompt', {
      modelId: 'flux-schnell-free',
      prompt: 'three gold coins stacked on a dark wooden table',
      enhancePrompt: true
    });

    const spec5 = res5.data;
    assert(spec5.counts.length > 0, 'Extracted count quantity: ' + JSON.stringify(spec5.counts));
    assert(spec5.counts.some(c => c.includes('three gold')), 'Preserved exact count "three gold"');
    assert(spec5.modelSpecificPrompt.includes('three gold coins stacked'), 'Preserved exact subject and action');
  } catch (err) {
    console.error('Test 5 failed with exception:', err.message);
  }

  console.log('\n========================================================================');
  console.log(`📊 EVALUATION SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('========================================================================');
}

runTestSuite().catch(console.error);
