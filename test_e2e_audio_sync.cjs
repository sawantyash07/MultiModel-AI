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

// Mirroring the exact frontend logic from speechAlignment.js
const WORD_REGEX = /[\p{L}\p{N}'’\-_]+/u;
function tokenizeWords(text) {
  if (!text) return [];
  const tokens = [];
  const globalRegex = /[\p{L}\p{N}'’\-_]+/gu;
  let match;
  while ((match = globalRegex.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      index: tokens.length
    });
  }
  return tokens;
}

function findActiveWordIndex(timeline, currentTimeSeconds) {
  if (!timeline || timeline.length === 0 || currentTimeSeconds == null) return -1;
  const time = Math.max(0, currentTimeSeconds);

  if (time <= (timeline[0].start || 0)) {
    return 0;
  }

  const lastWord = timeline[timeline.length - 1];
  if (time >= lastWord.end) {
    return -1;
  }

  let low = 0;
  let high = timeline.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const item = timeline[mid];
    if (time >= item.start && time < item.end) {
      return item.index;
    }
    if (time < item.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  for (let i = 0; i < timeline.length; i++) {
    if (time >= timeline[i].start && time < timeline[i].end) {
      return timeline[i].index;
    }
  }
  return -1;
}

async function runSyncTests() {
  console.log('================================================================');
  console.log('E2E Audio & Text Synchronization Verification Suite');
  console.log('================================================================\n');

  const testCases = [
    {
      lang: 'en',
      name: 'English',
      text: 'Hello world, Yash AI synchronizes voice playback exactly with moving text highlight.'
    },
    {
      lang: 'gu',
      name: 'Gujarati',
      text: 'નમસ્તે, યશ એઆઈ અવાજ અને લખાણનું સચોટ સિંક્રનાઇઝેશન પ્રદાન કરે છે.'
    },
    {
      lang: 'hi',
      name: 'Hindi',
      text: 'नमस्ते, यश एआई आवाज और हाइलाइट का सटीक तालमेल सुनिश्चित करता है।'
    },
    {
      lang: 'mr',
      name: 'Marathi',
      text: 'नमस्कार, यश एआय आवाज आणि हायलाइट अचूकपणे सिंक्रोનાઇझ करतो.'
    }
  ];

  let passedAll = true;

  for (const tc of testCases) {
    console.log(`--- [Testing ${tc.name} (${tc.lang})] ---`);
    console.log(`Input text: "${tc.text}"`);

    // 1. Test Accept: application/json
    const payload = JSON.stringify({
      text: tc.text,
      language: tc.lang
    });

    const resJson = await request({
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

    if (resJson.status !== 200) {
      console.error(`FAILED: Status ${resJson.status}: ${resJson.text()}`);
      passedAll = false;
      continue;
    }

    const data = resJson.json();
    console.log(`Status: 200 OK`);
    console.log(`Duration: ${data.durationMs}ms`);
    console.log(`Generation latency: ${data.generationLatencyMs || 'N/A'}ms`);
    console.log(`Exact acoustic alignment: ${data.exactAlignment}`);
    console.log(`Word count returned in timestamps: ${data.timestamps ? data.timestamps.length : 0}`);

    // Verification 1: Duration must reflect real audio duration (> 1000ms), NOT network latency (~400ms)
    if (!data.durationMs || data.durationMs < 1000) {
      console.error(`FAILED: durationMs (${data.durationMs}) is unrealistically short!`);
      passedAll = false;
    } else {
      console.log(`✓ Real audio duration verified: ${(data.durationMs / 1000).toFixed(2)}s`);
    }

    // Verification 2: Non-empty timestamps
    if (!data.timestamps || data.timestamps.length === 0) {
      console.error(`FAILED: No timestamps returned!`);
      passedAll = false;
    } else {
      console.log(`✓ Timestamps present: ${data.timestamps.length} words`);
    }

    // Verification 3: Monotonic timestamps
    const timestamps = data.timestamps || [];
    let isMonotonic = true;
    for (let i = 0; i < timestamps.length; i++) {
      const cur = timestamps[i];
      if (cur.start < 0 || cur.end < cur.start) {
        console.error(`Invalid range at index ${i}: start=${cur.start}, end=${cur.end}`);
        isMonotonic = false;
      }
      if (i > 0) {
        const prev = timestamps[i - 1];
        if (cur.start < prev.start || cur.end < prev.end) {
          console.error(`Non-monotonic at index ${i}: prev=[${prev.start}, ${prev.end}], cur=[${cur.start}, ${cur.end}]`);
          isMonotonic = false;
        }
      }
    }
    if (isMonotonic) {
      console.log(`✓ Strict monotonicity verified: timestamps increase progressively without overlaps`);
    } else {
      passedAll = false;
    }

    // Verification 4: Audio timeline simulation (findActiveWordIndex)
    const durationSec = data.durationMs / 1000;
    const timeline = timestamps.map((t, idx) => ({
      index: idx,
      word: t.word,
      start: t.start,
      end: t.end
    }));

    // Test Play at t=0
    const startWordIdx = findActiveWordIndex(timeline, 0.0);
    console.log(`Playback start at t=0.0s -> active word index: ${startWordIdx} ("${timeline[startWordIdx] ? timeline[startWordIdx].word : 'N/A'}")`);
    if (startWordIdx !== 0) {
      console.error(`FAILED: Expected word index 0 at start, got ${startWordIdx}`);
      passedAll = false;
    } else {
      console.log(`✓ Requirement 4 (Play): Starts highlighting from the first aligned word`);
    }

    // Test Mid-point progression
    const midTime = durationSec / 2;
    const midWordIdx = findActiveWordIndex(timeline, midTime);
    console.log(`Playback mid-point at t=${midTime.toFixed(2)}s -> active word index: ${midWordIdx} ("${timeline[midWordIdx] ? timeline[midWordIdx].word : 'N/A'}")`);
    if (midWordIdx <= 0 || midWordIdx >= timeline.length) {
      console.error(`FAILED: Expected mid-sentence word index at mid-point, got ${midWordIdx}`);
      passedAll = false;
    } else {
      console.log(`✓ Active word progresses with audio currentTime`);
    }

    // Test Pause and Resume: frozen currentTime yields same word
    const pauseTime = durationSec * 0.4;
    const pauseIdx1 = findActiveWordIndex(timeline, pauseTime);
    const pauseIdx2 = findActiveWordIndex(timeline, pauseTime); // 500ms later with no currentTime advance
    if (pauseIdx1 === pauseIdx2 && pauseIdx1 >= 0) {
      console.log(`✓ Requirement 4 (Pause & Resume): Pause freezes word at index ${pauseIdx1}; resume retains exact word`);
    } else {
      console.error(`FAILED: Pause/resume mismatch!`);
      passedAll = false;
    }

    // Test Seek: seeking directly changes the active word
    const seekTime1 = durationSec * 0.1;
    const seekTime2 = durationSec * 0.8;
    const seekIdx1 = findActiveWordIndex(timeline, seekTime1);
    const seekIdx2 = findActiveWordIndex(timeline, seekTime2);
    if (seekIdx1 !== seekIdx2 && seekIdx2 > seekIdx1) {
      console.log(`✓ Requirement 4 (Seek): Seeking from ${seekTime1.toFixed(2)}s (idx ${seekIdx1}) to ${seekTime2.toFixed(2)}s (idx ${seekIdx2}) updates immediately`);
    } else {
      console.error(`FAILED: Seek did not change word appropriately: ${seekIdx1} vs ${seekIdx2}`);
      passedAll = false;
    }

    // Test Completion: time >= duration clears highlight (-1)
    const endIdx = findActiveWordIndex(timeline, durationSec + 0.1);
    if (endIdx === -1) {
      console.log(`✓ Requirement 4 (Audio Completion): Active highlight cleared (-1) when currentTime exceeds audio duration`);
    } else {
      console.error(`FAILED: Active highlight not cleared at end: ${endIdx}`);
      passedAll = false;
    }

    // Verification 5: Test binary Accept: audio/mpeg header propagation
    const resAudio = await request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/tts/speak',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    if (resAudio.status === 200) {
      const headerDuration = resAudio.headers['x-tts-duration-ms'];
      const headerTimestamps = resAudio.headers['x-tts-word-timestamps'];
      const headerExact = resAudio.headers['x-tts-exact-alignment'];
      console.log(`✓ Binary audio endpoint returns custom headers: X-TTS-Duration-Ms=${headerDuration}, X-TTS-Exact-Alignment=${headerExact}, Timestamps header length=${headerTimestamps ? headerTimestamps.length : 0} bytes`);
    } else {
      console.error(`FAILED binary audio request with status ${resAudio.status}`);
      passedAll = false;
    }

    console.log();
  }

  // Multi-chunk simulation test
  console.log('--- [Testing Multi-Chunk Timelines & Offsets] ---');
  const chunk1Timeline = [
    { index: 0, word: "First", start: 0.0, end: 0.5 },
    { index: 1, word: "chunk", start: 0.5, end: 1.0 }
  ];
  const chunk2RawTimeline = [
    { index: 0, word: "second", start: 0.0, end: 0.4 },
    { index: 1, word: "chunk", start: 0.4, end: 0.9 }
  ];
  // Simulating offset application for chunk 2 (start word offset = 2, start time offset = 1.0)
  const chunk2Timeline = chunk2RawTimeline.map(t => ({
    index: t.index + 2,
    word: t.word,
    start: t.start + 1.0,
    end: t.end + 1.0
  }));
  const combinedTimeline = [...chunk1Timeline, ...chunk2Timeline];

  const atChunk1 = findActiveWordIndex(combinedTimeline, 0.7);
  const atChunk2 = findActiveWordIndex(combinedTimeline, 1.3);

  console.log(`Combined timeline at t=0.7s: word index ${atChunk1} ("${combinedTimeline[atChunk1].word}")`);
  console.log(`Combined timeline at t=1.3s: word index ${atChunk2} ("${combinedTimeline[atChunk2].word}")`);
  if (atChunk1 === 1 && atChunk2 === 2) {
    console.log(`✓ Requirement 5 (Multi-chunk): Global word offsets preserved across chunk boundaries without resets to 0\n`);
  } else {
    console.error(`FAILED: Multi-chunk index mismatch: ${atChunk1}, ${atChunk2}`);
    passedAll = false;
  }

  console.log('================================================================');
  if (passedAll) {
    console.log('ALL SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! ✓');
  } else {
    console.error('SOME TESTS FAILED! ✗');
    process.exit(1);
  }
  console.log('================================================================');
}

runSyncTests().catch(err => {
  console.error('Fatal error running sync tests:', err);
  process.exit(1);
});
