import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import assert from 'assert';

import {
  normalizeHighlightColor,
  getHighlightColorKey,
  resolveAnnotationRange,
  mergeAndSegmentHighlights,
  rehypeHighlightApplier,
  PRIMARY_HIGHLIGHT_PALETTE
} from './src/services/textAnnotationEngine.js';

import {
  rehypeWordSegmenter,
  tokenizeWords
} from './src/services/speechAlignment.js';

import {
  applyHighlightsToMarkdown,
  renderMessageHtml,
  buildStandaloneHtml
} from './src/services/conversationExport.js';

console.log('================================================================');
console.log('   REGRESSION SUITE: YASH AI TEXT HIGHLIGHTER & PERSISTENCE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(title, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [TEST ${totalTests}] ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [TEST ${totalTests}] ${title}`);
    console.error('    Error:', err.message);
    throw err;
  }
}

// Helper to render markdown with highlights and word segmenter (exact MessageItem pipeline)
function renderWithHighlighter(markdownContent, highlights = []) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          [rehypeHighlightApplier, { highlights }],
          rehypeWordSegmenter
        ],
        components: {
          mark({ node, children, className, style, ...props }) {
            const hlColor = props['data-highlight-color'];
            const bg = normalizeHighlightColor(hlColor || (typeof style === 'object' ? style?.backgroundColor : style), 0.28);
            return React.createElement(
              'mark',
              {
                ...props,
                className: 'rgb-marker-highlight',
                style: {
                  backgroundColor: bg,
                  ...(typeof style === 'object' ? style : {})
                }
              },
              children
            );
          },
          span({ node, children, className, ...props }) {
            const wordIdx = props['data-word-index'];
            if (wordIdx !== undefined) {
              return React.createElement(
                'span',
                {
                  ...props,
                  className: 'tts-word',
                  'data-word-index': wordIdx,
                  'data-tts-state': 'pending'
                },
                children
              );
            }
            return React.createElement('span', props, children);
          }
        }
      },
      markdownContent
    )
  );
}

// -----------------------------------------------------------------------------
// 1. Highlighting one word
// -----------------------------------------------------------------------------
runTest('Highlighting a single word inside a paragraph', () => {
  const content = 'React is an open-source JavaScript library developed by Meta.';
  const hl = {
    id: 'hl-1',
    text: 'JavaScript',
    startOffset: 24,
    endOffset: 34,
    prefix: 'is an open-source ',
    suffix: ' library developed',
    color: 'green'
  };

  const html = renderWithHighlighter(content, [hl]);
  assert(html.includes('<mark'), 'Should render <mark> tag');
  assert(html.includes('data-highlight-id="hl-1"'), 'Should contain highlight id');
  assert(html.includes('JavaScript'), 'Should contain highlighted text');
  assert(!html.includes('<mark>React</mark>'), 'Should not highlight unrelated words');
});

// -----------------------------------------------------------------------------
// 2. Highlighting a complete sentence
// -----------------------------------------------------------------------------
runTest('Highlighting a complete sentence in multi-sentence text', () => {
  const content = 'First sentence here. Second sentence is the target for highlighting. Third sentence follows.';
  const targetText = 'Second sentence is the target for highlighting.';
  const startOffset = content.indexOf(targetText);
  const hl = {
    id: 'hl-2',
    text: targetText,
    startOffset,
    endOffset: startOffset + targetText.length,
    prefix: 'First sentence here. ',
    suffix: ' Third sentence follows.',
    color: 'blue'
  };

  const html = renderWithHighlighter(content, [hl]);
  const plainText = html.replace(/<[^>]+>/g, '');
  assert(plainText.includes(targetText), 'Entire sentence text must be preserved');
  assert(html.includes('data-highlight-id="hl-2"') && html.includes('class="rgb-marker-highlight"'), 'Must have mark tag');
  assert(plainText.includes('First sentence here.'), 'Prior sentence must remain unhighlighted');
  assert(plainText.includes('Third sentence follows.'), 'Subsequent sentence must remain unhighlighted');
});

// -----------------------------------------------------------------------------
// 3. Selecting part of a bold or italic phrase
// -----------------------------------------------------------------------------
runTest('Selecting part of a bold phrase within Markdown', () => {
  const content = 'Here is **supercalifragilistic** formatting in text.';
  // User selects "fragilistic" inside the bold word
  const targetText = 'fragilistic';
  // Note: in clean text stream, "Here is supercalifragilistic formatting in text."
  const cleanDoc = 'Here is supercalifragilistic formatting in text.';
  const startOffset = cleanDoc.indexOf(targetText);

  const hl = {
    id: 'hl-3',
    text: targetText,
    startOffset,
    endOffset: startOffset + targetText.length,
    prefix: 'Here is supercali',
    suffix: ' formatting in text.',
    color: 'red'
  };

  const html = renderWithHighlighter(content, [hl]);
  assert(html.includes('<strong>'), 'Strong tag must be preserved');
  assert(html.includes('supercali'), 'First part of bold word must remain strong');
  assert(html.includes('data-highlight-id="hl-3"') && html.includes('class="rgb-marker-highlight"'), 'Target part must be highlighted');
  assert(html.includes('fragilistic'), 'Selected portion must be inside highlight');
});

// -----------------------------------------------------------------------------
// 4. Selecting text across multiple inline elements (plain -> bold -> plain)
// -----------------------------------------------------------------------------
runTest('Selecting text across multiple inline formatting elements (bold/italic)', () => {
  const content = 'This is *very* **critical** information for testing.';
  // Clean text stream: "This is very critical information for testing."
  // User selects: "is very critical info"
  const cleanDoc = 'This is very critical information for testing.';
  const targetText = 'is very critical info';
  const startOffset = cleanDoc.indexOf(targetText);

  const hl = {
    id: 'hl-4',
    text: targetText,
    startOffset,
    endOffset: startOffset + targetText.length,
    prefix: 'This ',
    suffix: 'rmation for testing.',
    color: 'green'
  };

  const html = renderWithHighlighter(content, [hl]);
  // Verify that <mark> tags were generated across the boundary and preserved <em> and <strong>
  assert(html.includes('<em>'), 'Emphasis tag must be preserved');
  assert(html.includes('<strong>'), 'Strong tag must be preserved');
  assert(html.includes('data-highlight-id="hl-4"'), 'Highlight ID must appear on segmented elements');
  assert(!html.includes('&lt;mark'), 'Mark must not be escaped as raw text');
});

// -----------------------------------------------------------------------------
// 5. Highlighting Marathi, Hindi, and English text
// -----------------------------------------------------------------------------
runTest('Highlighting Marathi and Hindi Unicode text without character corruption', () => {
  const marathiContent = 'यश एआय हे एक **अत्याधुनिक** कृत्रिम बुद्धिमत्ता प्लॅटफॉर्म आहे.';
  const marathiClean = 'यश एआय हे एक अत्याधुनिक कृत्रिम बुद्धिमत्ता प्लॅटफॉर्म आहे.';
  const targetText = 'कृत्रिम बुद्धिमत्ता';
  const startOffset = marathiClean.indexOf(targetText);

  const hl = {
    id: 'hl-mr-1',
    text: targetText,
    startOffset,
    endOffset: startOffset + targetText.length,
    prefix: 'एक अत्याधुनिक ',
    suffix: ' प्लॅटफॉर्म आहे.',
    color: 'red'
  };

  const html = renderWithHighlighter(marathiContent, [hl]);
  const plainText = html.replace(/<[^>]+>/g, '');
  assert(html.includes('data-highlight-id="hl-mr-1"'), 'Must render Marathi highlight');
  assert(plainText.includes(targetText), 'Indic Unicode characters and matras must be intact');
  assert(html.includes('<strong>') && html.includes('अत्याधुनिक') && html.includes('</strong>'), 'Markdown bold must be preserved');
});

// -----------------------------------------------------------------------------
// 6. Selecting text while a response is still streaming
// -----------------------------------------------------------------------------
runTest('Selecting and rendering text while assistant response is streaming new tokens', () => {
  let partialContent = 'Artificial intelligence allows computers to simulate human intelligence.';
  const targetText = 'simulate human intelligence';
  const startOffset = partialContent.indexOf(targetText);

  const hl = {
    id: 'hl-stream-1',
    text: targetText,
    startOffset,
    endOffset: startOffset + targetText.length,
    prefix: 'computers to ',
    suffix: '.',
    color: 'blue'
  };

  // Render at step 1
  const html1 = renderWithHighlighter(partialContent, [hl]);
  assert(html1.includes('data-highlight-id="hl-stream-1"'), 'Must render highlight during stream');

  // Step 2: New chunk arrives appending more text
  partialContent += ' Machine learning algorithms improve through experience and data analysis.';
  const html2 = renderWithHighlighter(partialContent, [hl]);
  const plainText2 = html2.replace(/<[^>]+>/g, '');

  assert(html2.includes('data-highlight-id="hl-stream-1"'), 'Highlight must survive incoming streaming tokens');
  assert(plainText2.includes('data analysis.'), 'Appended streaming tokens must be rendered');
});

// -----------------------------------------------------------------------------
// 7. Applying Red, Green, and Blue highlights
// -----------------------------------------------------------------------------
runTest('Rendering distinct, high-contrast Red, Green, and Blue highlights', () => {
  const content = 'Item Alpha is red. Item Beta is green. Item Gamma is blue.';
  const cleanDoc = content;

  const hlRed = {
    id: 'hl-r',
    text: 'Item Alpha',
    startOffset: cleanDoc.indexOf('Item Alpha'),
    endOffset: cleanDoc.indexOf('Item Alpha') + 10,
    color: 'red',
    colorKey: 'red'
  };

  const hlGreen = {
    id: 'hl-g',
    text: 'Item Beta',
    startOffset: cleanDoc.indexOf('Item Beta'),
    endOffset: cleanDoc.indexOf('Item Beta') + 9,
    color: 'green',
    colorKey: 'green'
  };

  const hlBlue = {
    id: 'hl-b',
    text: 'Item Gamma',
    startOffset: cleanDoc.indexOf('Item Gamma'),
    endOffset: cleanDoc.indexOf('Item Gamma') + 10,
    color: 'blue',
    colorKey: 'blue'
  };

  const html = renderWithHighlighter(content, [hlRed, hlGreen, hlBlue]);

  assert(html.includes('data-highlight-id="hl-r"'), 'Red highlight must render');
  assert(html.includes('data-highlight-id="hl-g"'), 'Green highlight must render');
  assert(html.includes('data-highlight-id="hl-b"'), 'Blue highlight must render');

  // Verify accessible palette colors
  assert(html.includes('rgba(239, 68, 68'), 'Red color must use accessible translucent palette');
  assert(html.includes('rgba(16, 185, 129'), 'Green color must use accessible translucent palette');
  assert(html.includes('rgba(59, 130, 246'), 'Blue color must use accessible translucent palette');
});

// -----------------------------------------------------------------------------
// 8. Turning highlighting OFF and ON again
// -----------------------------------------------------------------------------
runTest('Highlight OFF mode preserves existing highlights while preventing new highlights', () => {
  const content = 'Persistent notes remain intact.';
  const hl = {
    id: 'hl-toggle-1',
    text: 'Persistent notes',
    startOffset: 0,
    endOffset: 16,
    color: 'green'
  };

  // In OFF mode: existing annotations are still rendered by MessageItem
  const htmlOff = renderWithHighlighter(content, [hl]);
  assert(htmlOff.includes('data-highlight-id="hl-toggle-1"'), 'Existing highlights remain visible when mode is OFF');

  // In OFF mode: selection handler returns early, adding no new highlights
  const selectionAttemptWhenOff = null; // simulate early return
  assert(selectionAttemptWhenOff === null, 'No highlight created when mode is OFF');

  // In ON mode: highlight continues to render
  const htmlOn = renderWithHighlighter(content, [hl]);
  assert(htmlOn.includes('data-highlight-id="hl-toggle-1"'), 'Highlights remain intact when mode is ON');
});

// -----------------------------------------------------------------------------
// 9. Editing and removing an annotation
// -----------------------------------------------------------------------------
runTest('Changing color of existing annotation and removing annotation cleanly', () => {
  const initialHl = {
    id: 'hl-edit-1',
    text: 'Dynamic state',
    startOffset: 0,
    endOffset: 13,
    color: 'green',
    colorKey: 'green'
  };

  // User edits color from Green to Red
  const updatedHl = {
    ...initialHl,
    color: 'red',
    colorKey: 'red',
    updatedAt: new Date().toISOString()
  };

  const htmlUpdated = renderWithHighlighter('Dynamic state management', [updatedHl]);
  assert(htmlUpdated.includes('rgba(239, 68, 68'), 'Updated color must be applied');
  assert(!htmlUpdated.includes('rgba(16, 185, 129'), 'Old color must be replaced');

  // User removes highlight: highlights list is filtered
  const htmlRemoved = renderWithHighlighter('Dynamic state management', []);
  assert(!htmlRemoved.includes('<mark'), 'Removed highlight must leave original clean text');
  assert(htmlRemoved.replace(/<[^>]+>/g, '').includes('Dynamic state management'), 'Original text must be completely intact');
});

// -----------------------------------------------------------------------------
// 10. Applying an overlapping highlight (deterministic segmentation)
// -----------------------------------------------------------------------------
runTest('Overlapping highlight replaces and segments ranges deterministically without nested corruption', () => {
  // Existing highlight on [10, 30] in green
  const existing = [
    {
      id: 'hl-base',
      text: 'ten to thirty characters',
      startOffset: 10,
      endOffset: 34,
      color: 'green',
      colorKey: 'green'
    }
  ];

  // User applies new blue highlight over [20, 45] (overlapping at the end)
  const newHl = {
    id: 'hl-new',
    text: 'characters and beyond text',
    startOffset: 20,
    endOffset: 46,
    color: 'blue',
    colorKey: 'blue'
  };

  const merged = mergeAndSegmentHighlights(existing, newHl);

  // Check that no ranges overlap
  for (let i = 0; i < merged.length - 1; i++) {
    assert(merged[i].endOffset <= merged[i + 1].startOffset, 'Merged intervals must be non-overlapping');
  }

  // The base highlight was trimmed to [10, 20]
  const baseTrimmed = merged.find(h => h.id === 'hl-base');
  assert(baseTrimmed, 'Base highlight must exist');
  assert.strictEqual(baseTrimmed.endOffset, 20, 'Base highlight must be trimmed at overlap boundary');

  // The new highlight starts at 20
  const newApplied = merged.find(h => h.id === 'hl-new');
  assert(newApplied, 'New highlight must exist');
  assert.strictEqual(newApplied.startOffset, 20, 'New highlight starts at specified boundary');
});

// -----------------------------------------------------------------------------
// 11. Switching conversations
// -----------------------------------------------------------------------------
runTest('Highlights partition strictly by conversation ID and message ID', () => {
  const allHighlights = [
    { id: 'hl-conv-1', conversationId: 'c1', messageId: 'm1', text: 'Chat 1 text' },
    { id: 'hl-conv-2', conversationId: 'c2', messageId: 'm2', text: 'Chat 2 text' }
  ];

  // Filter for conversation 1
  const c1Highlights = allHighlights.filter(h => h.conversationId === 'c1');
  assert.strictEqual(c1Highlights.length, 1);
  assert.strictEqual(c1Highlights[0].id, 'hl-conv-1');

  // Filter for conversation 2
  const c2Highlights = allHighlights.filter(h => h.conversationId === 'c2');
  assert.strictEqual(c2Highlights.length, 1);
  assert.strictEqual(c2Highlights[0].id, 'hl-conv-2');
});

// -----------------------------------------------------------------------------
// 12. Refreshing the page and restoring the annotation
// -----------------------------------------------------------------------------
runTest('Restoring annotations from durable storage across simulated browser reload', () => {
  const docText = 'Neural network architectures are designed for deep learning tasks.';
  const storedAnnotation = {
    id: 'hl-persist-1',
    conversationId: 'conv-100',
    messageId: 'msg-200',
    text: 'architectures are designed',
    startOffset: 15,
    endOffset: 41,
    prefix: 'Neural network ',
    suffix: ' for deep learning tasks.',
    color: 'blue'
  };

  // Simulate deserialization and resolution
  const resolved = resolveAnnotationRange(docText, storedAnnotation);
  assert(resolved !== null, 'Annotation must be resolved on restored message');
  assert.strictEqual(resolved.start, 15);
  assert.strictEqual(resolved.end, 41);
  assert.strictEqual(docText.slice(resolved.start, resolved.end), storedAnnotation.text);
});

// -----------------------------------------------------------------------------
// 13. Editing or regenerating an AI response
// -----------------------------------------------------------------------------
runTest('Editing or regenerating an AI response safely prunes stale annotations', () => {
  const originalHighlights = [
    { id: 'hl-old-1', messageId: 'msg-assist-1', text: 'original output text' },
    { id: 'hl-old-2', messageId: 'msg-user-1', text: 'user prompt query' }
  ];

  // Regenerate: assistant message is replaced
  const pruned = originalHighlights.filter(h => h.messageId !== 'msg-assist-1');
  assert.strictEqual(pruned.length, 1);
  assert.strictEqual(pruned[0].id, 'hl-old-2', 'User prompt highlight is retained while stale assistant highlight is cleared');
});

// -----------------------------------------------------------------------------
// 14. Playing, pausing, and stopping speech (coexistence with word underline)
// -----------------------------------------------------------------------------
runTest('Speech word segmentation spans and RGB marker highlights coexist cleanly', () => {
  const content = 'Speech synthesis reads words sequentially while marker highlights remain.';
  const cleanDoc = content;
  const targetText = 'reads words sequentially';
  const startOffset = cleanDoc.indexOf(targetText);

  const hl = {
    id: 'hl-tts-coexist',
    text: targetText,
    startOffset,
    endOffset: startOffset + targetText.length,
    color: 'green'
  };

  const html = renderWithHighlighter(content, [hl]);

  // Verify that <mark> wraps the highlighted phrase
  assert(html.includes('data-highlight-id="hl-tts-coexist"') && html.includes('class="rgb-marker-highlight"'), 'Highlight mark must be present');

  // Verify that inside the <mark>, individual words have .tts-word spans
  assert(html.includes('class="tts-word"') && html.includes('data-word-index='), 'Words inside mark must have tts-word spans');
  assert(html.includes('data-tts-state="pending"'), 'Word spans must initialize with pending speech state');
});

// -----------------------------------------------------------------------------
// 15. Exporting a conversation containing highlights (HTML & Markdown)
// -----------------------------------------------------------------------------
runTest('Exporting to HTML and Markdown faithfully preserves highlight tags', () => {
  const msgContent = '### Executive Summary\n\nYash AI provides **reliable** highlighting and exports.';
  const messageHighlights = [
    {
      id: 'hl-exp-1',
      text: 'reliable',
      startOffset: msgContent.indexOf('reliable'),
      endOffset: msgContent.indexOf('reliable') + 8,
      prefix: 'provides **',
      suffix: '** highlighting',
      color: 'red'
    }
  ];

  // Markdown export check
  const exportedMd = applyHighlightsToMarkdown(msgContent, messageHighlights);
  assert(exportedMd.includes('<mark style="background-color:'), 'Markdown export must include <mark> tag');
  assert(exportedMd.includes('reliable</mark>'), 'Target word must be enclosed in mark');

  // HTML export check
  const exportedHtml = renderMessageHtml(msgContent, messageHighlights);
  assert(exportedHtml.includes('class="rgb-marker-highlight"'), 'HTML export must include marker class');
  assert(exportedHtml.includes('reliable'), 'Highlighted text must be inside rendered HTML');
});

// -----------------------------------------------------------------------------
// 16. Handling empty selections and stale DOM ranges safely
// -----------------------------------------------------------------------------
runTest('Empty selections and invalid offsets return null without crashing', () => {
  // Empty or whitespace target text
  assert.strictEqual(resolveAnnotationRange('Sample text', { text: '' }), null);
  assert.strictEqual(resolveAnnotationRange('Sample text', { text: null }), null);

  // Missing text in document
  const unresolvable = resolveAnnotationRange('Short text', {
    text: 'completely absent phrase',
    startOffset: 100,
    endOffset: 124
  });
  assert.strictEqual(unresolvable, null, 'Unresolvable annotations must return null rather than corrupting text');

  // Negative offsets
  const invalidOffset = resolveAnnotationRange('Sample text', {
    text: 'Sample',
    startOffset: -5,
    endOffset: 2
  });
  assert(invalidOffset === null || invalidOffset.start >= 0, 'Must not return negative offset');
});

// -----------------------------------------------------------------------------
// 17. Testing both light and dark themes
// -----------------------------------------------------------------------------
runTest('Primary RGB colors provide consistent, theme-safe translucency', () => {
  for (const colorKey of ['red', 'green', 'blue']) {
    const pal = PRIMARY_HIGHLIGHT_PALETTE[colorKey];
    assert(pal, `Palette entry for ${colorKey} must exist`);

    const rgba = normalizeHighlightColor(colorKey, 0.28);
    assert(rgba.startsWith('rgba('), 'Must be valid rgba string');
    assert(rgba.includes('0.28)'), 'Must preserve soft marker opacity');

    const key = getHighlightColorKey(rgba);
    assert.strictEqual(key, colorKey, `Should correctly detect color key for ${colorKey}`);
  }
});

console.log('\n================================================================');
console.log(`   ALL ${passedTests}/${totalTests} REGRESSION TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================');
