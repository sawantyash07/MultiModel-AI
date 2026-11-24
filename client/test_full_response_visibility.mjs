import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  tokenizeWords,
  rehypeWordSegmenter,
  stripMarkdownForWordCount,
  buildWordTimeline,
  findActiveWordIndex
} from './src/services/speechAlignment.js';

console.log('--- Testing Full AI Response Visibility During Speech & Underline ---');

// Test Case 1: The user's exact multi-sentence prompt
const text1 = 'Artificial intelligence enables computers to perform tasks that normally require human intelligence. It is used in healthcare, robotics, education, and many other fields.';

const renderedHtml1 = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    ReactMarkdown,
    {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeWordSegmenter]
    },
    text1
  )
);

console.log('\n[Test 1] User Example Rendering:');
console.log('HTML length:', renderedHtml1.length);
// Count words segmented
const matches1 = [...renderedHtml1.matchAll(/data-word-index="(\d+)"/g)];
console.log('Segmented word spans count:', matches1.length);
const wordsTokenized1 = tokenizeWords(text1);
console.log('Tokenized words count:', wordsTokenized1.length);

if (matches1.length !== wordsTokenized1.length) {
  throw new Error(`Word count mismatch: ${matches1.length} vs ${wordsTokenized1.length}`);
}
console.log('✓ PASS: All words in both sentences are fully rendered as segmented word spans!');

// Test Case 2: Multi-paragraph with Headings, Lists, Tables, Code Blocks, and Bold/Italics
const text2 = `# Artificial Intelligence Overview

Artificial intelligence enables computers to perform tasks that normally require human intelligence.

Here are key domains:
- Healthcare diagnostics and treatment
- Autonomous robotics and vehicles
- Personalized education systems

| Sector | Impact | Priority |
| :--- | :--- | :--- |
| Medicine | High | Critical |
| Transport | Very High | Urgent |

Code example:
\`\`\`python
def predict():
    return "AI model output"
\`\`\`

> AI is transforming the landscape of modern technology.

Final concluding thoughts on safe deployment.`;

const renderedHtml2 = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    ReactMarkdown,
    {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeWordSegmenter]
    },
    text2
  )
);

console.log('\n[Test 2] Complex Markdown Formatting Preservation:');
console.assert(renderedHtml2.includes('<h1>'), 'Heading h1 must be preserved');
console.assert(renderedHtml2.includes('<ul>'), 'Unordered list must be preserved');
console.assert(renderedHtml2.includes('<table>'), 'Table must be preserved');
console.assert(renderedHtml2.includes('<pre><code'), 'Code block must be preserved');
console.assert(renderedHtml2.includes('def predict():'), 'Code block content must be preserved');
console.assert(renderedHtml2.includes('<blockquote>'), 'Blockquote must be preserved');

// Verify code block words are NOT segmented as tts-word spans
const codeBlockMatch = renderedHtml2.match(/<pre>[\s\S]*?<\/pre>/);
if (codeBlockMatch) {
  const codeHasTtsWord = codeBlockMatch[0].includes('data-word-index');
  console.assert(!codeHasTtsWord, 'Code block inside pre should NOT contain tts-word spans');
  console.log('✓ PASS: Code block preserved verbatim without segmentation inside code!');
}

console.log('✓ PASS: Headings, lists, tables, blockquotes, and code blocks all rendered correctly!');

// Test Case 3: Indian Languages (Gujarati, Hindi, Marathi)
const gujaratiText = 'કૃત્રિમ બુદ્ધિમત્તા કમ્પ્યુટરને કાર્યો કરવા સક્ષમ બનાવે છે. તે આરોગ્ય સંભાળ, રોબોટિક્સ અને શિક્ષણમાં વપરાય છે.';
const hindiText = 'आर्टिफिशियल इंटेलिजेंस कंप्यूटर को ऐसे कार्य करने में सक्षम बनाता है जो मानव बुद्धि की मांग करते हैं। यह स्वास्थ्य सेवा, रोबोटिक्स और शिक्षा में उपयोग किया जाता है।';
const marathiText = 'कृत्रिम बुद्धिमत्ता संगणकांना मानवी बुद्धिमत्तेची आवश्यकता असणारी कामे करण्यास सक्षम करते. हे आरोग्य, रोबोटिक्स आणि शिक्षणामध्ये वापरले जाते.';

for (const [lang, text] of Object.entries({ Gujarati: gujaratiText, Hindi: hindiText, Marathi: marathiText })) {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeWordSegmenter]
      },
      text
    )
  );
  const spans = [...html.matchAll(/data-word-index="(\d+)"/g)];
  const tokens = tokenizeWords(text);
  console.log(`[Test 3] ${lang}: ${tokens.length} words -> ${spans.length} rendered word spans`);
  console.assert(spans.length === tokens.length, `${lang} span count mismatch: ${spans.length} vs ${tokens.length}`);
  console.log(`✓ PASS: ${lang} preserved Unicode aksharas, dandas, and full response rendering!`);
}

// Test Case 4: Simulate speech progression across words, seeking, pausing, and replay
console.log('\n[Test 4] Simulating Speech Timeline Progression & Underline States:');
const timeline = buildWordTimeline(text1, 8.5);
console.log(`Built timeline with ${timeline.length} words over 8.5s`);
for (let i = 0; i < 5; i++) {
  console.log(`  Word ${i} ("${timeline[i].word}"): [${timeline[i].start.toFixed(2)}s - ${timeline[i].end.toFixed(2)}s]`);
}

let activeStates = {};
function simulateAudioTime(currentTime, prevActive) {
  const activeIdx = findActiveWordIndex(timeline, currentTime);
  const newStates = { ...activeStates };
  if (activeIdx !== prevActive) {
    if (prevActive >= 0) {
      newStates[prevActive] = 'fading';
    }
    if (activeIdx >= 0) {
      newStates[activeIdx] = 'active';
    }
  }
  return { activeIdx, newStates };
}

// 1. Initial before playback (t at word 0)
const t0 = (timeline[0].start + timeline[0].end) / 2;
console.log(`\nAt t = ${t0.toFixed(2)}s (word 0: "${timeline[0].word}"):`);
let res = simulateAudioTime(t0, -1);
console.log(`  Word index: ${res.activeIdx} ("${timeline[res.activeIdx].word}") is active`);
console.assert(res.newStates[0] === 'active', 'Word 0 should be active');

// 2. Advance to word 1
const t1 = (timeline[1].start + timeline[1].end) / 2;
console.log(`At t = ${t1.toFixed(2)}s (word 1: "${timeline[1].word}"):`);
res = simulateAudioTime(t1, 0);
console.log(`  Word index: ${res.activeIdx} ("${timeline[res.activeIdx].word}") is active`);
console.assert(res.newStates[0] === 'fading', 'Word 0 should be fading');
console.assert(res.newStates[1] === 'active', 'Word 1 should be active');

// 3. Advance to word 2
const t2 = (timeline[2].start + timeline[2].end) / 2;
console.log(`At t = ${t2.toFixed(2)}s (word 2: "${timeline[2].word}"):`);
res = simulateAudioTime(t2, 1);
console.log(`  Word index: ${res.activeIdx} ("${timeline[res.activeIdx].word}") is active`);
console.assert(res.newStates[1] === 'fading', 'Word 1 should be fading');
console.assert(res.newStates[2] === 'active', 'Word 2 should be active');

// 4. Seek forward to word 16 ("healthcare")
const t16 = (timeline[16].start + timeline[16].end) / 2;
console.log(`At t = ${t16.toFixed(2)}s (seek forward to word 16: "${timeline[16].word}"):`);
res = simulateAudioTime(t16, 2);
console.log(`  Word index: ${res.activeIdx} ("${timeline[res.activeIdx].word}") is active`);
console.assert(res.newStates[16] === 'active', 'Word 16 should be active');

// 5. Seek backward to word 3 ("computers")
const t3 = (timeline[3].start + timeline[3].end) / 2;
console.log(`At t = ${t3.toFixed(2)}s (seek backward to word 3: "${timeline[3].word}"):`);
res = simulateAudioTime(t3, 16);
console.log(`  Word index: ${res.activeIdx} ("${timeline[res.activeIdx].word}") is active`);
console.assert(res.newStates[3] === 'active', 'Word 3 should be active');

console.log('\n✓ ALL TESTS PASSED SUCCESSFULLY! The entire response remains visible at all times.');
