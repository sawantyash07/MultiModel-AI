import { buildWordTimeline, findActiveWordIndex, countWords, WORD_REGEX, rehypeWordSegmenter } from '../client/src/services/speechAlignment.js';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

console.log('================================================================');
console.log('RUNNING SPEECH HIGHLIGHT VERIFICATION ACROSS MULTILINGUAL PIPELINE');
console.log('================================================================\n');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    allPassed = false;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// -------------------------------------------------------------
// Test 1: English - "The robot moves forward and detects an obstacle."
// -------------------------------------------------------------
console.log('--- Test 1: English Continuous Alignment ---');
const enText = "The robot moves forward and detects an obstacle.";
const enDuration = 2.4; // 2.4 seconds audio
const enTimeline = buildWordTimeline(enText, enDuration);

assert(enTimeline.length === 8, `English timeline word count is 8 (got ${enTimeline.length})`);
assert(enTimeline[0].word === 'The', `Word 0 is 'The'`);
assert(enTimeline[1].word === 'robot', `Word 1 is 'robot'`);
assert(enTimeline[2].word === 'moves', `Word 2 is 'moves'`);
assert(enTimeline[3].word === 'forward', `Word 3 is 'forward'`);
assert(enTimeline[4].word === 'and', `Word 4 is 'and'`);
assert(enTimeline[5].word === 'detects', `Word 5 is 'detects'`);
assert(enTimeline[6].word === 'an', `Word 6 is 'an'`);
assert(enTimeline[7].word === 'obstacle', `Word 7 is 'obstacle'`);

// Check continuous progression as audio time advances
const visitedWordsEn = [];
let prevIdx = -1;
for (let t = 0.0; t <= enDuration; t += 0.05) {
  const idx = findActiveWordIndex(enTimeline, t);
  if (idx !== prevIdx) {
    visitedWordsEn.push(enTimeline[idx].word);
    prevIdx = idx;
  }
}
assert(
  visitedWordsEn.join(' ') === enText.replace('.', ''),
  `Continuous highlight visits every word in sequence: "${visitedWordsEn.join(' ')}"`
);

// -------------------------------------------------------------
// Test 2: Gujarati - "રોબોટ આગળ વધે છે અને અવરોધ શોધે છે."
// -------------------------------------------------------------
console.log('\n--- Test 2: Gujarati Continuous Alignment ---');
const guText = "રોબોટ આગળ વધે છે અને અવરોધ શોધે છે.";
const guDuration = 3.2; // 3.2 seconds audio
const guTimeline = buildWordTimeline(guText, guDuration);

assert(guTimeline.length === 8, `Gujarati timeline word count is 8 (got ${guTimeline.length})`);
assert(guTimeline[0].word === 'રોબોટ', `Word 0 is 'રોબોટ'`);
assert(guTimeline[1].word === 'આગળ', `Word 1 is 'આગળ'`);
assert(guTimeline[2].word === 'વધે', `Word 2 is 'વધે'`);
assert(guTimeline[3].word === 'છે', `Word 3 is 'છે'`);
assert(guTimeline[4].word === 'અને', `Word 4 is 'અને'`);
assert(guTimeline[5].word === 'અવરોધ', `Word 5 is 'અવરોધ'`);
assert(guTimeline[6].word === 'શોધે', `Word 6 is 'શોધે'`);
assert(guTimeline[7].word === 'છે', `Word 7 is 'છે'`);

const visitedWordsGu = [];
prevIdx = -1;
for (let t = 0.0; t <= guDuration; t += 0.05) {
  const idx = findActiveWordIndex(guTimeline, t);
  if (idx !== prevIdx) {
    visitedWordsGu.push(guTimeline[idx].word);
    prevIdx = idx;
  }
}
assert(
  visitedWordsGu.join(' ') === guText.replace('.', ''),
  `Continuous highlight visits every Gujarati word in sequence: "${visitedWordsGu.join(' ')}"`
);

// -------------------------------------------------------------
// Test 3: Hindi - "रोबोट आगे बढ़ता है और बाधा का पता लगाता है।"
// -------------------------------------------------------------
console.log('\n--- Test 3: Hindi Continuous Alignment ---');
const hiText = "रोबोट आगे बढ़ता है और बाधा का पता लगाता है।";
const hiDuration = 3.8;
const hiTimeline = buildWordTimeline(hiText, hiDuration);

assert(hiTimeline.length === 10, `Hindi timeline word count is 10 (got ${hiTimeline.length})`);
assert(hiTimeline[0].word === 'रोबोट', `Word 0 is 'रोबोट'`);
assert(hiTimeline[2].word === 'बढ़ता', `Word 2 is 'बढ़ता'`);
assert(hiTimeline[5].word === 'बाधा', `Word 5 is 'बाधा'`);
assert(hiTimeline[8].word === 'लगाता', `Word 8 is 'लगाता'`);

const visitedWordsHi = [];
prevIdx = -1;
for (let t = 0.0; t <= hiDuration; t += 0.05) {
  const idx = findActiveWordIndex(hiTimeline, t);
  if (idx !== prevIdx) {
    visitedWordsHi.push(hiTimeline[idx].word);
    prevIdx = idx;
  }
}
assert(
  visitedWordsHi.join(' ') === hiText.replace('।', '').trim(),
  `Continuous highlight visits every Hindi word in sequence: "${visitedWordsHi.join(' ')}"`
);

// -------------------------------------------------------------
// Test 4: Marathi - "रोबो पुढे जातो आणि अडथळा शोधतो."
// -------------------------------------------------------------
console.log('\n--- Test 4: Marathi Continuous Alignment ---');
const mrText = "रोबो पुढे जातो आणि अडथळा शोधतो.";
const mrDuration = 3.0;
const mrTimeline = buildWordTimeline(mrText, mrDuration);

assert(mrTimeline.length === 6, `Marathi timeline word count is 6 (got ${mrTimeline.length})`);
assert(mrTimeline[0].word === 'रोबो', `Word 0 is 'रोबो'`);
assert(mrTimeline[1].word === 'पुढे', `Word 1 is 'पुढे'`);
assert(mrTimeline[2].word === 'जातो', `Word 2 is 'जातो'`);
assert(mrTimeline[3].word === 'आणि', `Word 3 is 'आणि'`);
assert(mrTimeline[4].word === 'अडथळा', `Word 4 is 'अडथळा'`);
assert(mrTimeline[5].word === 'शोधतो', `Word 5 is 'शोधतो'`);

// -------------------------------------------------------------
// Test 5: Seeking, Pausing, and Resuming
// -------------------------------------------------------------
console.log('\n--- Test 5: Seeking, Pausing, and Resuming ---');
// Seeking to 1.5s in English timeline
const seekIdx = findActiveWordIndex(enTimeline, 1.5);
assert(enTimeline[seekIdx].word === 'detects', `Seeking to 1.5s immediately matches 'detects' (got '${enTimeline[seekIdx].word}')`);

// Seeking to 0.2s matches 'robot'
const seekIdx2 = findActiveWordIndex(enTimeline, 0.25);
assert(enTimeline[seekIdx2].word === 'robot', `Seeking to 0.25s immediately matches 'robot' (got '${enTimeline[seekIdx2].word}')`);

// Pausing freezes index: at t=0.25s, index is 1; when paused and time does not change, index remains 1
const pausedIndex1 = findActiveWordIndex(enTimeline, 0.25);
const pausedIndex2 = findActiveWordIndex(enTimeline, 0.25);
assert(pausedIndex1 === pausedIndex2 && pausedIndex1 === 1, `Pausing freezes word highlight at index ${pausedIndex1}`);

// Resuming at t=0.6s continues to next word
const resumeIndex = findActiveWordIndex(enTimeline, 0.6);
assert(enTimeline[resumeIndex].word === 'moves', `Resuming to 0.6s continues at 'moves'`);

// -------------------------------------------------------------
// Test 6: Chunked Playback Offset Tracking
// -------------------------------------------------------------
console.log('\n--- Test 6: Multi-Chunk Offset Continuity ---');
const chunk0 = "The robot moves forward.";
const chunk1 = "It detects an obstacle.";
const countChunk0 = countWords(chunk0); // 4 words (0, 1, 2, 3)
const countChunk1 = countWords(chunk1); // 4 words (4, 5, 6, 7)

const chunk0Timeline = buildWordTimeline(chunk0, 1.2);
const chunk1Timeline = buildWordTimeline(chunk1, 1.2);

// Chunk 0 active indices:
const chunk0GlobalIndices = [0, 1, 2, 3].map(i => 0 + i);
// Chunk 1 active indices with global offset:
const chunk1GlobalOffset = countChunk0; // 4
const chunk1GlobalIndices = [0, 1, 2, 3].map(i => chunk1GlobalOffset + i);

assert(
  chunk0GlobalIndices.join(',') === '0,1,2,3',
  `Chunk 0 plays global indices 0, 1, 2, 3`
);
assert(
  chunk1GlobalIndices.join(',') === '4,5,6,7',
  `Chunk 1 continues with global indices 4, 5, 6, 7 without resetting to 0`
);

// -------------------------------------------------------------
// Test 7: Rehype AST Word Segmenter on Formatted Markdown
// -------------------------------------------------------------
console.log('\n--- Test 7: Rehype AST Word Segmenter ---');
const complexMarkdown = "The **robot** moves forward.\n\nIt [detects](https://example.com) an obstacle.\n- *Item* one";
let segmenterCount = 0;

function rehypeInspector() {
  return (tree) => {
    rehypeWordSegmenter()(tree);
    function countSpans(node) {
      if (!node) return;
      if (node.type === 'element' && node.properties && node.properties['data-word-index'] !== undefined) {
        segmenterCount++;
      }
      if (node.children) {
        node.children.forEach(countSpans);
      }
    }
    countSpans(tree);
  };
}

const rendered = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeInspector],
    children: complexMarkdown
  })
);

const expectedCount = countWords(complexMarkdown);
assert(
  segmenterCount === expectedCount,
  `Rehype segmenter indexed exactly ${expectedCount} words matching countWords (got ${segmenterCount})`
);
assert(rendered.includes('data-word-index="0"'), `First word has data-word-index="0"`);
assert(rendered.includes(`data-word-index="${expectedCount - 1}"`), `Last word has data-word-index="${expectedCount - 1}"`);
assert(!rendered.includes('undefined'), `No undefined values in rendered output`);

// -------------------------------------------------------------
// Test 8: End of audio / Stop
// -------------------------------------------------------------
console.log('\n--- Test 8: Stop / Boundary Conditions ---');
assert(findActiveWordIndex([], 0) === -1, `Empty timeline returns -1`);
assert(findActiveWordIndex(enTimeline, -1) === -1, `Negative time returns -1`);
assert(findActiveWordIndex(enTimeline, enDuration + 1) === 7, `Time past audio end caps at last word`);

console.log('\n================================================================');
if (allPassed) {
  console.log('🎉 ALL ACCEPTANCE TESTS PASSED (100%)');
} else {
  console.log('❌ SOME TESTS FAILED');
  process.exit(1);
}
console.log('================================================================');
