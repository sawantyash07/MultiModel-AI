const http = require('http');

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== YASH AI DYNAMIC SUGGESTION ENGINE TEST SUITE ===\n');

  // Wait for server health
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const h = await request({ host: 'localhost', port: 8080, path: '/api/health', method: 'GET' });
      if (h.status === 200) {
        ready = true;
        console.log('✅ Spring Boot backend is healthy on port 8080.\n');
        break;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!ready) {
    console.error('❌ Server failed to respond to /api/health within 40s');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test GET /api/chat/personalized-suggestions
  console.log('--- TEST 1: Personalized Dashboard Suggestions (Cards & Chips) ---');
  try {
    const res1 = await request({ host: 'localhost', port: 8080, path: '/api/chat/personalized-suggestions', method: 'GET' });
    assert(res1.status === 200, 'HTTP status is 200');
    assert(Array.isArray(res1.data.cards) && res1.data.cards.length === 5, 'Contains 5 dynamic feature cards');
    assert(Array.isArray(res1.data.chips) && res1.data.chips.length === 5, 'Contains 5 dynamic suggestion chips');
    assert(res1.data.cards[0].id && res1.data.cards[0].title && res1.data.cards[0].prompt, 'Card 0 has id, title, and prompt');
    assert(res1.data.chips[0].label && res1.data.chips[0].prompt, 'Chip 0 has label and prompt');
    console.log(`  Dynamic Starter Chips: ${res1.data.chips.map(c => `"${c.label}"`).join(', ')}`);
  } catch (e) {
    assert(false, `Test 1 failed with error: ${e.message}`);
  }

  // 2. Test MEMS micropump follow-up suggestions
  console.log('\n--- TEST 2: MEMS Micropump Follow-up Suggestions ---');
  try {
    const res2 = await request({
      host: 'localhost', port: 8080, path: '/api/chat/suggestions', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      prompt: 'Explain the working principles of a MEMS micropump with diagram',
      answer: 'A MEMS micropump utilizes micro-electro-mechanical fabrication (lithography, DRIE) to pump fluids using piezoelectric or electrostatic diaphragms...',
      modelId: 'auto'
    });
    assert(res2.status === 200, 'HTTP status is 200');
    assert(Array.isArray(res2.data.suggestions) && res2.data.suggestions.length >= 3, `Returned ${res2.data.suggestions?.length} suggestions (>= 3)`);
    assert(res2.data.topic && res2.data.topic.toLowerCase().includes('mems'), `Topic detected as MEMS: "${res2.data.topic}"`);
    const s0 = res2.data.suggestions[0];
    assert(s0.title && s0.prompt && s0.category, 'Structured item has title, prompt, and category');
    assert(typeof s0.isAiGenerated === 'boolean', `isAiGenerated flag is boolean: ${s0.isAiGenerated}`);
    console.log('  MEMS Suggestions:');
    res2.data.suggestions.forEach((s, idx) => {
      console.log(`    [${idx + 1}] [${s.category}] "${s.title}": ${s.prompt} (AI: ${s.isAiGenerated})`);
    });
    const memsKeywords = ['actuator', 'pull-in', 'voltage', 'fabrication', 'biomedical', 'piezoelectric', 'electrostatic', 'flow'];
    const matched = res2.data.suggestions.some(s => memsKeywords.some(kw => (s.prompt + ' ' + s.title).toLowerCase().includes(kw)));
    assert(matched, 'Suggestions contain MEMS specific concepts (actuator, pull-in voltage, fabrication, etc.)');
  } catch (e) {
    assert(false, `Test 2 failed with error: ${e.message}`);
  }

  // 3. Test Java DSA follow-up suggestions
  console.log('\n--- TEST 3: Java DSA Follow-up Suggestions ---');
  try {
    const res3 = await request({
      host: 'localhost', port: 8080, path: '/api/chat/suggestions', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      prompt: 'Solve the LRU cache problem in Java with full complexity analysis',
      answer: 'Here is the Java implementation of LRU Cache using HashMap and a Doubly Linked List with O(1) get and put...',
      modelId: 'auto'
    });
    assert(res3.status === 200, 'HTTP status is 200');
    assert(Array.isArray(res3.data.suggestions) && res3.data.suggestions.length >= 3, `Returned ${res3.data.suggestions?.length} suggestions`);
    assert(res3.data.topic && res3.data.topic.toLowerCase().includes('java'), `Topic detected as Java DSA: "${res3.data.topic}"`);
    console.log('  Java DSA Suggestions:');
    res3.data.suggestions.forEach((s, idx) => {
      console.log(`    [${idx + 1}] [${s.category}] "${s.title}": ${s.prompt}`);
    });
    const dsaKeywords = ['complexity', 'edge', 'space', 'time', 'structure', 'alternative', 'interview', 'optimization'];
    const matched = res3.data.suggestions.some(s => dsaKeywords.some(kw => (s.prompt + ' ' + s.title).toLowerCase().includes(kw)));
    assert(matched, 'Suggestions contain DSA specific concepts (complexity, edge cases, alternative structures, etc.)');
  } catch (e) {
    assert(false, `Test 3 failed with error: ${e.message}`);
  }

  // 4. Test React Frontend follow-up suggestions
  console.log('\n--- TEST 4: React Development Follow-up Suggestions ---');
  try {
    const res4 = await request({
      host: 'localhost', port: 8080, path: '/api/chat/suggestions', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      prompt: 'How to write custom React hooks for debouncing and optimizing re-renders?',
      answer: 'You can create a useDebounce hook using useEffect and useRef, and wrap component rendering with React.memo and useMemo...',
      modelId: 'auto'
    });
    assert(res4.status === 200, 'HTTP status is 200');
    assert(Array.isArray(res4.data.suggestions) && res4.data.suggestions.length >= 3, `Returned ${res4.data.suggestions?.length} suggestions`);
    assert(res4.data.topic && res4.data.topic.toLowerCase().includes('react'), `Topic detected as React: "${res4.data.topic}"`);
    console.log('  React Suggestions:');
    res4.data.suggestions.forEach((s, idx) => {
      console.log(`    [${idx + 1}] [${s.category}] "${s.title}": ${s.prompt}`);
    });
    const reactKeywords = ['hook', 'render', 'memo', 'test', 'vitest', 'component', 'performance', 'state'];
    const matched = res4.data.suggestions.some(s => reactKeywords.some(kw => (s.prompt + ' ' + s.title).toLowerCase().includes(kw)));
    assert(matched, 'Suggestions contain React specific concepts (hook, memoization, testing, refactoring)');
  } catch (e) {
    assert(false, `Test 4 failed with error: ${e.message}`);
  }

  // 5. Test Document Intelligence suggestions with Attachment
  console.log('\n--- TEST 5: Document Intelligence Follow-up Suggestions with Attachment ---');
  try {
    const res5 = await request({
      host: 'localhost', port: 8080, path: '/api/chat/suggestions', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      prompt: 'Please summarize this quarterly technical review document',
      answer: 'The attached document details Q3 technical milestones, model latency improvements, and error bounds...',
      attachments: [{ name: 'technical_review_q3.pdf', type: 'application/pdf', size: 1048576 }],
      modelId: 'auto'
    });
    assert(res5.status === 200, 'HTTP status is 200');
    assert(Array.isArray(res5.data.suggestions) && res5.data.suggestions.length >= 3, `Returned ${res5.data.suggestions?.length} suggestions`);
    assert(res5.data.topic && res5.data.topic.toLowerCase().includes('document'), `Topic detected as Document: "${res5.data.topic}"`);
    console.log('  Document Suggestions:');
    res5.data.suggestions.forEach((s, idx) => {
      console.log(`    [${idx + 1}] [${s.category}] "${s.title}": ${s.prompt}`);
    });
    const docKeywords = ['summary', 'metrics', 'extract', 'empirical', 'comprehension', 'questions', 'document'];
    const matched = res5.data.suggestions.some(s => docKeywords.some(kw => (s.prompt + ' ' + s.title).toLowerCase().includes(kw)));
    assert(matched, 'Suggestions contain Document Intelligence concepts (summary, metrics, questions)');
  } catch (e) {
    assert(false, `Test 5 failed with error: ${e.message}`);
  }

  // 6. Test Image Generation suggestions
  console.log('\n--- TEST 6: Image Generation Follow-up Suggestions ---');
  try {
    const res6 = await request({
      host: 'localhost', port: 8080, path: '/api/chat/suggestions', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      prompt: 'Generate a 3D robot arm image in an engineering laboratory with emerald lighting',
      answer: 'Generating 3D photorealistic robotic manipulator arm with carbon-fiber chassis and emerald status joints...',
      modelId: 'auto'
    });
    assert(res6.status === 200, 'HTTP status is 200');
    assert(Array.isArray(res6.data.suggestions) && res6.data.suggestions.length >= 3, `Returned ${res6.data.suggestions?.length} suggestions`);
    assert(res6.data.topic && res6.data.topic.toLowerCase().includes('image'), `Topic detected as Image Gen: "${res6.data.topic}"`);
    console.log('  Image Gen Suggestions:');
    res6.data.suggestions.forEach((s, idx) => {
      console.log(`    [${idx + 1}] [${s.category}] "${s.title}": ${s.prompt}`);
    });
    const imgKeywords = ['lighting', 'camera', 'macro', 'style', 'cyberpunk', 'render', 'composition', 'variation'];
    const matched = res6.data.suggestions.some(s => imgKeywords.some(kw => (s.prompt + ' ' + s.title).toLowerCase().includes(kw)));
    assert(matched, 'Suggestions contain visual variation concepts (lighting, camera angles, style variations)');
  } catch (e) {
    assert(false, `Test 6 failed with error: ${e.message}`);
  }

  // 7. Test Topic Adaptation on Subject Shift
  console.log('\n--- TEST 7: Topic Adaptation on Subject Shift ---');
  try {
    const res7 = await request({
      host: 'localhost', port: 8080, path: '/api/chat/suggestions', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      prompt: 'Actually, forget Java DSA. Explain the working of piezoelectric MEMS micropumps instead.',
      answer: 'Piezoelectric MEMS micropumps use PZT thin films that flex when an AC voltage is applied, generating a peristaltic pumping action...',
      history: [
        { role: 'user', content: 'Solve binary tree maximum path sum in Java' },
        { role: 'assistant', content: 'Here is the recursive DFS solution in Java...' }
      ],
      modelId: 'auto'
    });
    assert(res7.status === 200, 'HTTP status is 200');
    assert(res7.data.topic && res7.data.topic.toLowerCase().includes('mems'), `Subject shift adapted to MEMS: "${res7.data.topic}"`);
    const containsJava = res7.data.suggestions.some(s => s.prompt.toLowerCase().includes('binary tree') || s.prompt.toLowerCase().includes('leetcode'));
    assert(!containsJava, 'Deduplicated & adapted: does NOT repeat previous Java topic questions');
  } catch (e) {
    assert(false, `Test 7 failed with error: ${e.message}`);
  }

  console.log(`\n========================================`);
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
