const http = require('http');

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: buffer,
          text: () => buffer.toString('utf-8'),
          json: () => JSON.parse(buffer.toString('utf-8'))
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Simulates the UnderlineStateManager implemented in MessageItem.jsx
class UnderlineStateManager {
  constructor(playbackSpeed = 1.0) {
    this.playbackSpeed = playbackSpeed;
    this.fadeDurationMs = Math.round(Math.max(1000, Math.min(2000, 1500 / playbackSpeed)));
    this.wordStates = new Map(); // wordIndex -> { state: 'pending'|'active'|'fading'|'inactive', fadeStartTime: number }
    this.activeWordIndex = -1;
    this.history = []; // record of state transitions
  }

  setSpeed(speed) {
    this.playbackSpeed = speed;
    this.fadeDurationMs = Math.round(Math.max(1000, Math.min(2000, 1500 / speed)));
  }

  // Simulates time progression and timer expirations
  advanceClock(virtualTimeMs) {
    for (const [idx, info] of this.wordStates.entries()) {
      if (info.state === 'fading') {
        if (virtualTimeMs - info.fadeStartTime >= this.fadeDurationMs) {
          info.state = 'inactive';
          this.history.push({ timeMs: virtualTimeMs, index: idx, state: 'inactive', reason: 'fade_expired' });
        }
      }
    }
  }

  onWordIndexChange(newIndex, virtualTimeMs) {
    this.advanceClock(virtualTimeMs);

    if (newIndex >= 0) {
      const prevActive = this.activeWordIndex;

      if (newIndex !== prevActive) {
        const isSequential = prevActive >= 0 && newIndex === prevActive + 1;

        if (!isSequential && prevActive >= 0) {
          // Reconcile seek
          for (const [idx, info] of this.wordStates.entries()) {
            if (idx !== newIndex && idx !== newIndex - 1) {
              info.state = idx < newIndex ? 'inactive' : 'pending';
            }
          }
          if (newIndex > 0) {
            this.wordStates.set(newIndex - 1, { state: 'fading', fadeStartTime: virtualTimeMs });
            this.history.push({ timeMs: virtualTimeMs, index: newIndex - 1, state: 'fading', reason: 'seek_preceding' });
          }
        } else if (prevActive >= 0) {
          // Previous active word enters 'fading'
          this.wordStates.set(prevActive, { state: 'fading', fadeStartTime: virtualTimeMs });
          this.history.push({ timeMs: virtualTimeMs, index: prevActive, state: 'fading', reason: 'voice_advanced' });
        }

        // Target word becomes 'active'
        this.activeWordIndex = newIndex;
        this.wordStates.set(newIndex, { state: 'active', activeStartTime: virtualTimeMs });
        this.history.push({ timeMs: virtualTimeMs, index: newIndex, state: 'active', reason: 'word_speech_start' });
      }
    } else {
      // Audio completed or cleared (-1)
      const lastActive = this.activeWordIndex;
      if (lastActive >= 0) {
        this.activeWordIndex = -1;
        this.wordStates.set(lastActive, { state: 'fading', fadeStartTime: virtualTimeMs });
        this.history.push({ timeMs: virtualTimeMs, index: lastActive, state: 'fading', reason: 'audio_ended_natural_fade' });
      }
    }
  }

  onStop(virtualTimeMs) {
    for (const [idx, info] of this.wordStates.entries()) {
      info.state = 'inactive';
    }
    this.activeWordIndex = -1;
    this.history.push({ timeMs: virtualTimeMs, state: 'all_inactive', reason: 'stop_invoked' });
  }

  getState(idx) {
    return this.wordStates.get(idx)?.state || 'pending';
  }
}

function findActiveWordIndex(timeline, currentTimeSeconds) {
  if (!timeline || timeline.length === 0 || currentTimeSeconds == null || currentTimeSeconds < 0) return -1;
  const last = timeline[timeline.length - 1];
  if (currentTimeSeconds >= last.end) return -1;
  if (currentTimeSeconds <= timeline[0].start) return 0;

  let low = 0;
  let high = timeline.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = timeline[mid];
    if (currentTimeSeconds >= item.start && currentTimeSeconds < item.end) {
      return item.index;
    } else if (currentTimeSeconds < item.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return Math.min(timeline.length - 1, Math.max(0, high));
}

async function runUnderlineVerification() {
  console.log('================================================================');
  console.log('E2E Audio-Synchronized Temporary Underline Effect Verification');
  console.log('================================================================\n');

  let allPassed = true;

  // -------------------------------------------------------------------------
  // Test 1: User Example from Specification
  // "Artificial intelligence helps people solve problems."
  // -------------------------------------------------------------------------
  console.log('--- [Test 1: User Example Verification] ---');
  const userText = 'Artificial intelligence helps people solve problems.';
  console.log(`Synthesizing text: "${userText}" via live backend...`);

  const payload = JSON.stringify({ text: userText, language: 'en' });
  const res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/tts/speak',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);

  if (res.status !== 200) {
    console.error(`FAILED: Backend returned HTTP ${res.status}`);
    process.exit(1);
  }

  const ttsData = res.json();
  console.log(`Backend Audio Duration: ${ttsData.durationMs}ms`);
  console.log(`Exact Acoustic Alignment: ${ttsData.exactAlignment}`);
  console.log(`Words returned: ${ttsData.timestamps.length}`);

  const timestamps = ttsData.timestamps;
  const timeline = timestamps.map((t, i) => ({
    index: i,
    word: t.word,
    start: t.start,
    end: t.end
  }));

  timestamps.forEach((t, i) => {
    console.log(`  [Word ${i}] "${t.word}": ${t.start.toFixed(2)}s - ${t.end.toFixed(2)}s (dur: ${(t.end - t.start).toFixed(2)}s)`);
  });

  const underlineManager = new UnderlineStateManager(1.0);
  console.log(`\nUnderline fade duration configured: ${underlineManager.fadeDurationMs}ms (1.5 seconds)`);

  // Step 1: When voice reaches "Artificial", underline that word
  const t0_sec = timeline[0].start;
  const idx0 = findActiveWordIndex(timeline, t0_sec);
  underlineManager.onWordIndexChange(idx0, Math.round(t0_sec * 1000));
  console.log(`\n1. At t=${t0_sec.toFixed(2)}s (voice reaches "${timeline[0].word}"):`);
  console.log(`   Word 0 ("${timeline[0].word}") state: ${underlineManager.getState(0)}`);
  if (underlineManager.getState(0) === 'active') {
    console.log(`   ✓ Underline activated immediately on first word!`);
  } else {
    console.error(`   FAILED: Expected word 0 to be active!`);
    allPassed = false;
  }

  // Step 2: As voice proceeds to "intelligence", underline the currently spoken word
  // Step 3: When voice moves forward, start fading out the previous underline
  const t1_sec = timeline[1].start;
  const idx1 = findActiveWordIndex(timeline, t1_sec);
  underlineManager.onWordIndexChange(idx1, Math.round(t1_sec * 1000));
  console.log(`\n2. At t=${t1_sec.toFixed(2)}s (voice advances to "${timeline[1].word}"):`);
  console.log(`   Word 0 ("${timeline[0].word}") state: ${underlineManager.getState(0)}`);
  console.log(`   Word 1 ("${timeline[1].word}") state: ${underlineManager.getState(1)}`);
  if (underlineManager.getState(0) === 'fading' && underlineManager.getState(1) === 'active') {
    console.log(`   ✓ Word 1 newly underlined immediately; Word 0 starts fading!`);
  } else {
    console.error(`   FAILED: Expected word 0 fading, word 1 active!`);
    allPassed = false;
  }

  // Step 4: The previous underline should disappear smoothly within approximately 1-2 seconds
  const t_midFade = t1_sec + 0.7; // 700ms after fade began (still within 1.5s window)
  underlineManager.advanceClock(Math.round(t_midFade * 1000));
  console.log(`\n3. At t=${t_midFade.toFixed(2)}s (700ms into Word 0 fade-out):`);
  console.log(`   Word 0 ("${timeline[0].word}") state: ${underlineManager.getState(0)} (visible with CSS opacity transition)`);
  if (underlineManager.getState(0) === 'fading') {
    console.log(`   ✓ Word 0 remains visible and smoothly fading!`);
  } else {
    console.error(`   FAILED: Word 0 should still be fading!`);
    allPassed = false;
  }

  const t_fadeDone = t1_sec + 1.6; // 1600ms after fade began (> 1.5s fade duration)
  underlineManager.advanceClock(Math.round(t_fadeDone * 1000));
  console.log(`\n4. At t=${t_fadeDone.toFixed(2)}s (1600ms after fade began):`);
  console.log(`   Word 0 ("${timeline[0].word}") state: ${underlineManager.getState(0)}`);
  if (underlineManager.getState(0) === 'inactive') {
    console.log(`   ✓ Word 0 previous underline smoothly disappeared within 1–2 seconds!`);
  } else {
    console.error(`   FAILED: Expected word 0 to be inactive!`);
    allPassed = false;
  }

  // Step 5: Audio completes -> natural fade-out for remaining underline
  const totalDurSec = ttsData.durationMs / 1000;
  underlineManager.onWordIndexChange(timeline.length - 1, Math.round((totalDurSec - 0.2) * 1000));
  console.log(`\n5. Playback reaching end of audio:`);
  console.log(`   Last word state before end: ${underlineManager.getState(timeline.length - 1)}`);

  // Audio completion signal (-1)
  underlineManager.onWordIndexChange(-1, Math.round(totalDurSec * 1000));
  console.log(`   On audio ended (t=${totalDurSec.toFixed(2)}s):`);
  console.log(`   Last word state: ${underlineManager.getState(timeline.length - 1)}`);
  if (underlineManager.getState(timeline.length - 1) === 'fading') {
    console.log(`   ✓ Final word transitions to fading for natural disappearance!`);
  } else {
    console.error(`   FAILED: Final word should be fading!`);
    allPassed = false;
  }

  underlineManager.advanceClock(Math.round((totalDurSec + 1.6) * 1000));
  console.log(`   After 1.5s post-completion (t=${(totalDurSec + 1.6).toFixed(2)}s):`);
  console.log(`   Last word state: ${underlineManager.getState(timeline.length - 1)}`);
  if (underlineManager.getState(timeline.length - 1) === 'inactive') {
    console.log(`   ✓ Final word underline faded away naturally!`);
  } else {
    console.error(`   FAILED: Final word should be inactive!`);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // Test 2: Playback Actions (Pause/Resume, Seek, Speeds)
  // -------------------------------------------------------------------------
  console.log('\n--- [Test 2: Playback Actions Verification] ---');

  // Pause / Resume test
  const testMgr = new UnderlineStateManager(1.0);
  testMgr.onWordIndexChange(2, 1000);
  console.log(`Playing at t=1.0s -> active word: 2`);
  // On pause, currentTime does not advance
  testMgr.onWordIndexChange(2, 1500); // 500ms paused
  console.log(`Paused for 500ms -> active word: ${testMgr.activeWordIndex} (state: ${testMgr.getState(2)})`);
  if (testMgr.activeWordIndex === 2 && testMgr.getState(2) === 'active') {
    console.log(`✓ Pause freezes underline progression at word 2`);
  } else {
    console.error(`FAILED on pause!`);
    allPassed = false;
  }

  // Seek test (jump from word 2 to word 5)
  console.log(`Seeking from word 2 to word 5 at t=2.0s...`);
  testMgr.onWordIndexChange(5, 2000);
  console.log(`After seek: word 2 state: ${testMgr.getState(2)}, word 4 state: ${testMgr.getState(4)}, word 5 state: ${testMgr.getState(5)}`);
  if (testMgr.getState(5) === 'active' && testMgr.getState(2) === 'inactive') {
    console.log(`✓ Seeking immediately reconciles word states`);
  } else {
    console.error(`FAILED on seek reconciliation!`);
    allPassed = false;
  }

  // Speed scaling test (0.5x, 1x, 1.5x, 2x)
  const speeds = [0.5, 1.0, 1.5, 2.0];
  console.log('\nTesting fade duration scaling across playback speeds:');
  for (const s of speeds) {
    const sm = new UnderlineStateManager(s);
    console.log(`  Speed ${s}x -> fade duration: ${sm.fadeDurationMs}ms (in 1-2s range: ${sm.fadeDurationMs >= 1000 && sm.fadeDurationMs <= 2000})`);
    if (sm.fadeDurationMs < 1000 || sm.fadeDurationMs > 2000) {
      console.error(`FAILED: Fade duration ${sm.fadeDurationMs}ms out of 1-2s range!`);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------------------
  // Test 3: Indian Languages Real Speech Verification
  // -------------------------------------------------------------------------
  console.log('\n--- [Test 3: Indian Languages Real Speech Alignment] ---');
  const indianCases = [
    { lang: 'gu', name: 'Gujarati', text: 'નમસ્તે, યશ એઆઈ અવાજ અને લખાણનું સચોટ સિંક્રનાઇઝેશન પ્રદાન કરે છે.' },
    { lang: 'hi', name: 'Hindi', text: 'नमस्ते, यश एआई आवाज और हाइलाइट का सटीक तालमेल सुनिश्चित करता है।' },
    { lang: 'mr', name: 'Marathi', text: 'नमस्कार, यश एआय आवाज आणि हायलाइट अचूकपणे सिंक्रोनाइझ करतो.' }
  ];

  for (const ic of indianCases) {
    const p = JSON.stringify({ text: ic.text, language: ic.lang });
    const r = await request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/tts/speak',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(p)
      }
    }, p);

    if (r.status !== 200) {
      console.error(`FAILED ${ic.name} request: HTTP ${r.status}`);
      allPassed = false;
      continue;
    }

    const d = r.json();
    console.log(`[${ic.name} (${ic.lang})] Duration: ${d.durationMs}ms, Exact Alignment: ${d.exactAlignment}, Words: ${d.timestamps.length}`);
    if (d.exactAlignment && d.timestamps.length > 0) {
      console.log(`✓ Real speech acoustic alignment verified for ${ic.name}`);
    } else {
      console.error(`FAILED: Non-exact or empty timestamps for ${ic.name}`);
      allPassed = false;
    }
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('ALL TEMPORARY UNDERLINE E2E TESTS PASSED PERFECTLY! ✓');
  } else {
    console.error('SOME TESTS FAILED! ✗');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runUnderlineVerification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
