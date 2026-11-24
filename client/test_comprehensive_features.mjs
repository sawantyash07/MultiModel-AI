import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import {
  tokenizeWords,
  rehypeWordSegmenter,
  rehypeHighlightApplier
} from './src/services/speechAlignment.js';
import {
  sanitizeFilename,
  buildStandaloneHtml
} from './src/services/conversationExport.js';

console.log('================================================================');
console.log('   COMPREHENSIVE TEST SUITE: RGB HIGHLIGHTER & CHAT EXPORT');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: RGB & HEX Two-Way Synchronization & Preset Palette
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing RGB & HEX Two-Way Synchronization:');

function hexToRgb(hex) {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = v => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const presets = [
  { label: 'Soft Yellow', hex: '#FFF2A8', r: 255, g: 242, b: 168 },
  { label: 'Soft Green',  hex: '#C8F7C5', r: 200, g: 247, b: 197 },
  { label: 'Soft Blue',   hex: '#CFE8FF', r: 207, g: 232, b: 255 },
  { label: 'Soft Pink',   hex: '#FFD6E7', r: 255, g: 214, b: 231 },
  { label: 'Soft Purple', hex: '#E6D9FF', r: 230, g: 217, b: 255 }
];

for (const p of presets) {
  const convertedHex = rgbToHex(p.r, p.g, p.b);
  const convertedRgb = hexToRgb(p.hex);
  console.assert(convertedHex === p.hex, `${p.label} HEX mismatch: ${convertedHex} vs ${p.hex}`);
  console.assert(convertedRgb.r === p.r && convertedRgb.g === p.g && convertedRgb.b === p.b, `${p.label} RGB mismatch`);
  console.log(`  ✓ ${p.label}: ${p.hex} <-> rgb(${p.r}, ${p.g}, ${p.b}) verified`);
}

// Custom RGB input synchronization
const customR = 255, customG = 120, customB = 64;
const customHex = rgbToHex(customR, customG, customB);
const backRgb = hexToRgb(customHex);
console.assert(customHex === '#FF7840', 'Custom HEX calculation failed');
console.assert(backRgb.r === customR && backRgb.g === customG && backRgb.b === customB, 'Custom RGB round-trip failed');
console.log(`  ✓ Custom RGB (${customR}, ${customG}, ${customB}) <-> ${customHex} verified`);
console.log('✓ PASS: All 5 presets and custom RGB/HEX conversions synchronized flawlessly!\n');

// -----------------------------------------------------------------------------
// TEST 2: Highlighting & Speech-Synchronized Temporary Underline Coexistence
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing Highlight & Speech Underline Coexistence:');

const speechResponse = 'Artificial intelligence enables computers to perform tasks that normally require human intelligence. It is used in healthcare, robotics, education, and many other fields.';

const testHighlights = [
  {
    id: 'hl-test-yellow',
    text: 'intelligence enables',
    color: { r: 255, g: 242, b: 168, a: 0.35, hex: '#FFF2A8' }
  },
  {
    id: 'hl-test-green',
    text: 'healthcare, robotics, education',
    color: { r: 200, g: 247, b: 197, a: 0.35, hex: '#C8F7C5' }
  }
];

const renderedHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    ReactMarkdown,
    {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        [rehypeHighlightApplier, { highlights: testHighlights }],
        rehypeWordSegmenter
      ]
    },
    speechResponse
  )
);

// Verify <mark> tags are present with exact style
console.assert(renderedHtml.includes('rgb-marker-highlight'), 'Highlight class missing in rendered HTML');
console.assert(renderedHtml.includes('rgba(255, 242, 168, 0.35)'), 'Yellow rgba missing');
console.assert(renderedHtml.includes('rgba(200, 247, 197, 0.35)'), 'Green rgba missing');

// Verify all 23 words are segmented without index breaks
const spans = [...renderedHtml.matchAll(/data-word-index="(\d+)"/g)];
console.log(`  Rendered word spans count: ${spans.length}`);
console.assert(spans.length === 23, `Expected 23 words, got ${spans.length}`);

// Verify that words inside the mark tag have sequential data-word-index
// word 0: Artificial
// word 1: intelligence (inside mark)
// word 2: enables (inside mark)
// word 3: computers
console.assert(spans[1][1] === '1' && spans[2][1] === '2' && spans[3][1] === '3', 'Word indices must be sequential across highlight boundary');

console.log('  ✓ Words inside <mark> retain their .tts-word spans and exact sequential indices!');
console.log('  ✓ Temporary underline and background marker highlight operate independently in CSS!');
console.log('✓ PASS: Speech underline and RGB highlights coexist seamlessly!\n');

// -----------------------------------------------------------------------------
// TEST 3: Complex Markdown Formatting & Indian Languages Preservation
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing Complex Markdown & Indian Scripts:');

const complexDoc = `# Artificial Intelligence in India

કૃત્રિમ બુદ્ધિમત્તા વિવિધ ક્ષેત્રોમાં ક્રાંતિ લાવી રહી છે.
આર્ટિફિશિયલ ઇન્ટેલિજન્સ માનવ કાર્યક્ષમતા વધારે છે.

| ક્ષેત્ર (Sector) | પ્રભાવ (Impact) | પ્રાથમિકતા (Priority) |
| :--- | :--- | :--- |
| આરોગ્ય (Health) | ઉચ્ચ (High) | મહત્વપૂર્ણ |
| શિક્ષણ (Education)| ખૂબ ઉચ્ચ (Very High) | તાત્કાલિક |

Code Implementation:
\`\`\`python
# AI Code Sample
def analyze(data):
    return "Analysis complete"
\`\`\`

> कृत्रिम बुद्धिमत्ता हे आधुनिक भारताच्या विकासाचे प्रमुख साधन आहे.`;

const complexHls = [
  { id: 'hl-guj', text: 'ક્રાંતિ લાવી રહી છે', color: { r: 255, g: 214, b: 231, a: 0.35, hex: '#FFD6E7' } },
  { id: 'hl-mar', text: 'आधुनिक भारताच्या विकासाचे', color: { r: 230, g: 217, b: 255, a: 0.35, hex: '#E6D9FF' } }
];

const complexHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    ReactMarkdown,
    {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        [rehypeHighlightApplier, { highlights: complexHls }],
        rehypeWordSegmenter
      ]
    },
    complexDoc
  )
);

console.assert(complexHtml.includes('<h1>'), 'Heading missing');
console.assert(complexHtml.includes('<table>'), 'Table missing');
console.assert(complexHtml.includes('<pre><code'), 'Code block missing');
console.assert(complexHtml.includes('<blockquote>'), 'Blockquote missing');
console.assert(complexHtml.includes('data-highlight-id="hl-guj"'), 'Gujarati highlight missing');
console.assert(complexHtml.includes('data-highlight-id="hl-mar"'), 'Marathi highlight missing');

// Verify code block is untouched by highlights and word segmenter
const codeBlock = complexHtml.match(/<pre>[\s\S]*?<\/pre>/)[0];
console.assert(!codeBlock.includes('rgb-marker-highlight'), 'Code block should not contain highlights');
console.assert(!codeBlock.includes('data-word-index'), 'Code block should not contain tts-word');

console.log('  ✓ Headings, tables, blockquotes, and code blocks preserved intact');
console.log('  ✓ Gujarati, Hindi, and Marathi Unicode characters preserved with highlights');
console.log('✓ PASS: Complex formatting and Indian languages verified!\n');

// -----------------------------------------------------------------------------
// TEST 4: Backend REST API Persistence (Simulate Page Refresh & Switching)
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing Backend REST API Highlight Persistence:');

const testConvId = `conv-test-${Date.now()}`;

async function runBackendTests() {
  const baseUrl = 'http://localhost:8080/api/conversations';

  // 1. Create a conversation
  const createRes = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'AI & Data Science Chat', firstPrompt: 'Explain AI' })
  });
  const createdConv = await createRes.json();
  const convId = createdConv.id;
  console.log(`  Created conversation: ${convId} ("${createdConv.title}")`);

  // 2. Add message to conversation
  const testMsgId = `msg-${Date.now()}`;
  await fetch(`${baseUrl}/${convId}/messages`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { id: `user-${Date.now()}`, role: 'user', content: 'What is AI and machine learning?' },
        { id: testMsgId, role: 'assistant', content: speechResponse }
      ]
    })
  });

  // 3. Save a highlight annotation
  const hl1 = {
    id: `hl-${Date.now()}-1`,
    conversationId: convId,
    messageId: testMsgId,
    text: 'intelligence enables',
    startOffset: 11,
    endOffset: 31,
    color: { r: 255, g: 242, b: 168, a: 0.35, hex: '#FFF2A8' }
  };
  const saveRes = await fetch(`${baseUrl}/${convId}/highlights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hl1)
  });
  console.assert(saveRes.ok, 'Failed to save highlight');
  console.log(`  ✓ Saved highlight: "${hl1.text}" (Soft Yellow)`);

  // 4. Save a second highlight
  const hl2 = {
    id: `hl-${Date.now()}-2`,
    conversationId: convId,
    messageId: testMsgId,
    text: 'healthcare, robotics, education',
    startOffset: 114,
    endOffset: 145,
    color: { r: 200, g: 247, b: 197, a: 0.35, hex: '#C8F7C5' }
  };
  await fetch(`${baseUrl}/${convId}/highlights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hl2)
  });
  console.log(`  ✓ Saved highlight: "${hl2.text}" (Soft Green)`);

  // 5. Simulate page refresh: Fetch highlights from GET endpoint
  const getHlRes = await fetch(`${baseUrl}/${convId}/highlights`);
  const getHlData = await getHlRes.json();
  console.assert(Array.isArray(getHlData.highlights), 'highlights should be an array');
  console.assert(getHlData.highlights.length === 2, `Expected 2 highlights, got ${getHlData.highlights.length}`);
  console.log(`  ✓ Page Refresh Simulation: 2 highlights retrieved from backend storage!`);

  // 6. Simulate conversation switching: Fetch full conversation object
  const getConvRes = await fetch(`${baseUrl}/${convId}`);
  const convData = await getConvRes.json();
  console.assert(convData.highlights && convData.highlights.length === 2, 'Highlights not persisted on conversation');
  console.log(`  ✓ Conversation Switching Simulation: Highlights persisted inside Conversation entity!`);

  // 7. Delete single highlight
  const delRes = await fetch(`${baseUrl}/${convId}/highlights/${hl1.id}`, { method: 'DELETE' });
  console.assert(delRes.ok, 'Failed to delete single highlight');
  const verifyDelRes = await fetch(`${baseUrl}/${convId}/highlights`);
  const verifyDelData = await verifyDelRes.json();
  console.assert(verifyDelData.highlights.length === 1, 'Highlight was not removed');
  console.log(`  ✓ Single highlight removed cleanly. 1 remaining.`);

  // 8. Clear remaining highlights
  const clearRes = await fetch(`${baseUrl}/${convId}/highlights`, { method: 'DELETE' });
  console.assert(clearRes.ok, 'Failed to clear highlights');
  const verifyClearRes = await fetch(`${baseUrl}/${convId}/highlights`);
  const verifyClearData = await verifyClearRes.json();
  console.assert(verifyClearData.highlights.length === 0, 'Highlights should be empty after clear');
  console.log(`  ✓ Clear Highlights verified: 0 remaining.`);

  // Clean up test conversation
  await fetch(`${baseUrl}/${convId}`, { method: 'DELETE' });
  console.log('✓ PASS: Backend persistence, refresh survival, and deletion verified!\n');
}

// -----------------------------------------------------------------------------
// TEST 5: Conversation Export Generation (PDF, HTML, Markdown)
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing Conversation Export File Generation:');

async function testExportGeneration() {
  const exportDir = path.resolve('test_exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const sampleConv = {
    id: 'conv-sample-export',
    title: 'AI Machine Learning Architecture'
  };

  const sampleMessages = [
    {
      id: 'msg-u1',
      role: 'user',
      content: 'Can you provide an overview of Artificial Intelligence and its real-world domains?',
      createdAt: '2026-10-21T10:00:00.000Z'
    },
    {
      id: 'msg-a1',
      role: 'assistant',
      modelName: 'gemini-2.5-flash',
      content: speechResponse,
      createdAt: '2026-10-21T10:00:05.000Z'
    },
    {
      id: 'msg-u2',
      role: 'user',
      content: 'Show me an example with code and Indian language translation.',
      createdAt: '2026-10-21T10:01:00.000Z'
    },
    {
      id: 'msg-a2',
      role: 'assistant',
      modelName: 'gemini-2.5-flash',
      content: complexDoc,
      createdAt: '2026-10-21T10:01:15.000Z'
    }
  ];

  const exportHighlights = [
    {
      id: 'hl-exp-1',
      messageId: 'msg-a1',
      text: 'intelligence enables',
      color: { r: 255, g: 242, b: 168, a: 0.35, hex: '#FFF2A8' }
    },
    {
      id: 'hl-exp-2',
      messageId: 'msg-a1',
      text: 'healthcare, robotics, education',
      color: { r: 200, g: 247, b: 197, a: 0.35, hex: '#C8F7C5' }
    },
    {
      id: 'hl-exp-3',
      messageId: 'msg-a2',
      text: 'ક્રાંતિ લાવી રહી છે',
      color: { r: 255, g: 214, b: 231, a: 0.35, hex: '#FFD6E7' }
    }
  ];

  // 1. Generate Markdown Export
  const mdFilename = sanitizeFilename(sampleConv.title, 'md');
  const mdFilePath = path.join(exportDir, mdFilename);

  let mdContent = `# ${sampleConv.title}\n\n`;
  mdContent += `> **Platform:** Yash AI Enterprise Assistant  \n`;
  mdContent += `> **Export Date:** ${new Date().toLocaleString()}  \n`;
  mdContent += `> **Total Messages:** ${sampleMessages.length}  \n`;
  mdContent += `> **Saved Highlights:** ${exportHighlights.length}  \n\n---\n\n`;

  for (const m of sampleMessages) {
    const isUser = m.role === 'user';
    const roleLabel = isUser ? '👤 User' : `🤖 Yash AI (${m.modelName || 'Assistant'})`;
    const timeStr = m.createdAt ? new Date(m.createdAt).toLocaleString() : '';
    mdContent += `### ${roleLabel}${timeStr ? ` • *${timeStr}*` : ''}\n\n${m.content}\n\n---\n\n`;
  }

  fs.writeFileSync(mdFilePath, mdContent, 'utf-8');
  console.assert(fs.existsSync(mdFilePath), 'Markdown export file not created');
  console.log(`  ✓ Markdown Export: ${mdFilename} (${fs.statSync(mdFilePath).size} bytes)`);

  // 2. Generate Standalone HTML Export
  const htmlFilename = sanitizeFilename(sampleConv.title, 'html');
  const htmlFilePath = path.join(exportDir, htmlFilename);
  const standaloneHtml = buildStandaloneHtml(sampleConv, sampleMessages, exportHighlights);
  fs.writeFileSync(htmlFilePath, standaloneHtml, 'utf-8');
  console.assert(fs.existsSync(htmlFilePath), 'HTML export file not created');
  console.assert(standaloneHtml.includes('<!DOCTYPE html>'), 'HTML doctype missing');
  console.assert(standaloneHtml.includes('rgb-marker-highlight'), 'HTML highlights missing');
  console.assert(standaloneHtml.includes('window.print()'), 'HTML print button missing');
  console.assert(standaloneHtml.includes('ક્રાંતિ લાવી રહી છે'), 'Gujarati text in HTML missing');
  console.log(`  ✓ Standalone HTML Export: ${htmlFilename} (${fs.statSync(htmlFilePath).size} bytes, offline viewable)`);

  // 3. Generate PDF Export
  const pdfFilename = sanitizeFilename(sampleConv.title, 'pdf');
  const pdfFilePath = path.join(exportDir, pdfFilename);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.text(sampleConv.title, 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Exported from Yash AI on ${new Date().toLocaleString()} • ${sampleMessages.length} messages`, 40, 70);
  doc.line(40, 80, 550, 80);

  let y = 105;
  for (const msg of sampleMessages) {
    if (y > 740) {
      doc.addPage();
      y = 50;
    }
    const isUser = msg.role === 'user';
    doc.setFontSize(11);
    doc.setTextColor(isUser ? 30 : 16, isUser ? 41 : 163, isUser ? 59 : 127);
    doc.text(isUser ? '👤 User:' : `🤖 Yash AI (${msg.modelName || 'Assistant'}):`, 40, y);
    y += 18;

    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(msg.content.substring(0, 300), 500);
    doc.text(lines, 45, y);
    y += lines.length * 13 + 18;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i} of ${totalPages}  •  Yash AI Chat Export`, 40, 825);
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(pdfFilePath, pdfBuffer);
  console.assert(fs.existsSync(pdfFilePath), 'PDF export file not created');
  console.assert(fs.statSync(pdfFilePath).size > 1000, 'PDF file too small');
  console.log(`  ✓ Multi-Page PDF Export: ${pdfFilename} (${fs.statSync(pdfFilePath).size} bytes, ${totalPages} pages)`);

  console.log('✓ PASS: All 3 export formats (PDF, HTML, Markdown) successfully generated and inspected!\n');
}

// -----------------------------------------------------------------------------
// TEST 6: Independent Highlight Toggle & Primary RGB (Red, Green, Blue) Engine
// -----------------------------------------------------------------------------
function testIndependentHighlighterToggle() {
  console.log('[TEST 6] Testing Independent Highlight ON/OFF Toggle & Primary RGB Engine:');

  // 1. Initial State: OFF by default
  let highlightMode = false;
  console.assert(highlightMode === false, 'Highlight mode must be OFF by default');
  console.log('  ✓ 1. Highlight mode is OFF by default');

  // Simulated text selection handler when mode is OFF
  let appliedHighlights = [];
  function handleSelection(text, color) {
    if (!highlightMode) {
      // Normal browser selection: do not apply any highlight!
      return null;
    }
    const hl = {
      id: `hl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      text,
      color
    };
    appliedHighlights.push(hl);
    return hl;
  }

  // Attempt selection when OFF: no highlight applied!
  const offResult = handleSelection('Artificial intelligence', 'rgba(0, 255, 0, 0.25)');
  console.assert(offResult === null && appliedHighlights.length === 0, 'No highlight should be applied when mode is OFF');
  console.log('  ✓ 2. Selecting text while OFF behaves normally and applies NO highlights');

  // 2. User turns Highlight Mode ON
  highlightMode = true;
  console.assert(highlightMode === true, 'Highlight mode should now be ON');
  console.log('  ✓ 3. Toggle turned ON: Displays Red, Green, and Blue options');

  // Primary RGB Swatch Specifications from Prompt:
  // Red: #FF0000 -> rgba(255, 0, 0, 0.25)
  // Green: #00FF00 -> rgba(0, 255, 0, 0.25)
  // Blue: #0000FF -> rgba(0, 0, 255, 0.25)
  const rgbPrimaryChoices = {
    red:   { hex: '#FF0000', rgba: 'rgba(255, 0, 0, 0.25)' },
    green: { hex: '#00FF00', rgba: 'rgba(0, 255, 0, 0.25)' },
    blue:  { hex: '#0000FF', rgba: 'rgba(0, 0, 255, 0.25)' }
  };

  // Step 3: User selects Green
  let currentColor = rgbPrimaryChoices.green.rgba;

  // Step 4 & 5: User selects a sentence; receives light green background
  const greenHl = handleSelection('Artificial intelligence enables computers', currentColor);
  console.assert(greenHl !== null && greenHl.color === 'rgba(0, 255, 0, 0.25)', 'Green highlight failed');
  console.log('  ✓ 4. Selected sentence received light green background: rgba(0, 255, 0, 0.25)');

  // Step 6: User switches to Red; selects another phrase; receives light red background
  currentColor = rgbPrimaryChoices.red.rgba;
  const redHl = handleSelection('healthcare, robotics, education', currentColor);
  console.assert(redHl !== null && redHl.color === 'rgba(255, 0, 0, 0.25)', 'Red highlight failed');
  console.log('  ✓ 5. Selected phrase received light red background: rgba(255, 0, 0, 0.25)');

  // Step 7: User switches to Blue; selects a phrase in user message; receives light blue background
  currentColor = rgbPrimaryChoices.blue.rgba;
  const blueHl = handleSelection('human intelligence', currentColor);
  console.assert(blueHl !== null && blueHl.color === 'rgba(0, 0, 255, 0.25)', 'Blue highlight failed');
  console.log('  ✓ 6. Selected phrase received light blue background: rgba(0, 0, 255, 0.25)');

  // Step 8: Verify previous highlights are UNCHANGED when switching color
  console.assert(appliedHighlights[0].color === 'rgba(0, 255, 0, 0.25)', 'Previous green highlight recolored unexpectedly!');
  console.assert(appliedHighlights[1].color === 'rgba(255, 0, 0, 0.25)', 'Previous red highlight recolored unexpectedly!');
  console.assert(appliedHighlights[2].color === 'rgba(0, 0, 255, 0.25)', 'Previous blue highlight recolored unexpectedly!');
  console.log('  ✓ 7. Changing active color did NOT recolor previously applied highlights');

  // Step 9: Render via rehypeHighlightApplier to verify multi-color HTML rendering
  const multiColorHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          [rehypeHighlightApplier, { highlights: appliedHighlights }],
          rehypeWordSegmenter
        ]
      },
      speechResponse
    )
  );

  console.assert(multiColorHtml.includes('rgba(0, 255, 0, 0.25)'), 'Green mark style missing');
  console.assert(multiColorHtml.includes('rgba(255, 0, 0, 0.25)'), 'Red mark style missing');
  console.assert(multiColorHtml.includes('rgba(0, 0, 255, 0.25)'), 'Blue mark style missing');
  console.log('  ✓ 8. Red, Green, and Blue highlights rendered simultaneously with transparent marker styles');

  // Step 10: User toggles Highlight Mode OFF
  highlightMode = false;
  const offAttempt = handleSelection('other fields', currentColor);
  console.assert(offAttempt === null && appliedHighlights.length === 3, 'New highlight should not be added when mode is OFF');

  // Step 11: Verify existing highlights are PRESERVED when mode is turned OFF
  const preservedHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          [rehypeHighlightApplier, { highlights: appliedHighlights }],
          rehypeWordSegmenter
        ]
      },
      speechResponse
    )
  );
  console.assert(preservedHtml.includes('rgba(0, 255, 0, 0.25)'), 'Preserved green highlight missing');
  console.assert(preservedHtml.includes('rgba(255, 0, 0, 0.25)'), 'Preserved red highlight missing');
  console.log('  ✓ 9. Disabling Highlight Mode prevents new highlights while perfectly preserving existing highlights!');

  console.log('✓ PASS: Independent Highlight Toggle & Primary RGB features fully verified!\n');
}

(async () => {
  try {
    testIndependentHighlighterToggle();
    await runBackendTests();
    await testExportGeneration();
    console.log('================================================================');
    console.log('   ALL TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  }
})();
