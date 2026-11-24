// Comprehensive Export Pipeline Verification Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock minimal browser globals for Node.js test environment
if (!globalThis.window) {
  globalThis.window = {
    open: () => ({
      document: {
        open: () => {},
        write: () => {},
        close: () => {},
        fonts: { ready: Promise.resolve() }
      },
      focus: () => {},
      print: () => {}
    })
  };
}

let lastDownloadedBlob = null;
let lastDownloadedFilename = null;

if (!globalThis.document) {
  globalThis.document = {
    body: {
      appendChild: (el) => {},
      removeChild: (el) => {}
    },
    createElement: (tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: function() {
            lastDownloadedFilename = this.download;
          }
        };
      }
      return {};
    }
  };
}

globalThis.URL.createObjectURL = (blob) => {
  lastDownloadedBlob = blob;
  return 'blob:mock-url-12345';
};
globalThis.URL.revokeObjectURL = () => {};

import {
  sanitizeFilename,
  parseMessageTimestamp,
  formatTimestampDisplay,
  reconcileConversationMessages,
  reconcileHighlights,
  convertMarkdownToPlainText,
  applyHighlightsToMarkdown,
  renderAttachmentsHtml,
  renderMessageHtml,
  buildStandaloneHtml,
  exportToText,
  exportToMarkdown,
  exportToHtml
} from './src/services/conversationExport.js';

async function runTests() {
  console.log('================================================================================');
  console.log('       YASH AI COMPLETE CONVERSATION EXPORT PIPELINE TEST SUITE                 ');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
    }
  }

  // TEST SUITE 1: Filename Sanitization & Platform Safety
  console.log('\n--- 1. Filename Sanitization & Unicode Support ---');

  test('Sanitizes standard title with spaces and uppercase', () => {
    const fn = sanitizeFilename('Machine Learning Architecture Guide', 'md');
    assert.strictEqual(fn.startsWith('Yash-AI_Machine-Learning-Architecture-Guide_'), true);
    assert.strictEqual(fn.endsWith('.md'), true);
  });

  test('Strips illegal OS filename characters (\\ / : * ? " < > |)', () => {
    const fn = sanitizeFilename('Project / Plan: 100% "Working" <Test>? *Cool* | Yes', 'txt');
    assert.strictEqual(fn.includes('/'), false);
    assert.strictEqual(fn.includes('\\'), false);
    assert.strictEqual(fn.includes(':'), false);
    assert.strictEqual(fn.includes('*'), false);
    assert.strictEqual(fn.includes('?'), false);
    assert.strictEqual(fn.includes('"'), false);
    assert.strictEqual(fn.includes('<'), false);
    assert.strictEqual(fn.includes('>'), false);
    assert.strictEqual(fn.includes('|'), false);
    assert.strictEqual(fn.endsWith('.txt'), true);
  });

  test('Preserves Indian language scripts (Devanagari, Hindi, Marathi, Gujarati)', () => {
    const fnHindi = sanitizeFilename('मशीन लर्निंग और कृत्रिम बुद्धिमत्ता', 'html');
    assert.strictEqual(fnHindi.includes('मशीन-लर्निंग-और-कृत्रिम-बुद्धिमत्ता'), true);
    assert.strictEqual(fnHindi.endsWith('.html'), true);

    const fnGujarati = sanitizeFilename('ગુજરાતી આર્ટિફિશિયલ ઇન્ટેલિજન્સ', 'pdf');
    assert.strictEqual(fnGujarati.includes('ગુજરાતી-આર્ટિફિશિયલ-ઇન્ટેલિજન્સ'), true);
    assert.strictEqual(fnGujarati.endsWith('.pdf'), true);
  });

  test('Handles empty, null, or symbol-only titles safely with fallback', () => {
    const fnNull = sanitizeFilename(null, 'md');
    assert.strictEqual(fnNull.startsWith('Yash-AI_Conversation_'), true);

    const fnSymbols = sanitizeFilename('???///:::***', 'md');
    assert.strictEqual(fnSymbols.startsWith('Yash-AI_Conversation_'), true);

    const fnDottedExt = sanitizeFilename('My Chat', '.txt');
    assert.strictEqual(fnDottedExt.endsWith('.txt'), true);
    assert.strictEqual(fnDottedExt.includes('..'), false);
  });

  // TEST SUITE 2: Timestamp Parsing & Formatting
  console.log('\n--- 2. Timestamp Parsing & Formatting ---');

  test('Parses Java Date.toString() format without "Invalid Date"', () => {
    const d = parseMessageTimestamp('Wed Oct 21 19:47:01 IST 2026', 'msg-123');
    assert.notStrictEqual(d, null);
    assert.strictEqual(isNaN(d.getTime()), false);
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 9); // October
    const str = formatTimestampDisplay(d, 'datetime');
    assert.strictEqual(str.includes('Invalid Date'), false);
    assert.strictEqual(str.length > 5, true);
  });

  test('Parses ISO 8601 strings with nanoseconds', () => {
    const d = parseMessageTimestamp('2026-10-21T17:18:27.584819100Z', 'msg-456');
    assert.notStrictEqual(d, null);
    assert.strictEqual(isNaN(d.getTime()), false);
    assert.strictEqual(d.getUTCFullYear(), 2026);
  });

  test('Falls back to extracting timestamp from message ID (msg-<epoch>)', () => {
    const d = parseMessageTimestamp(null, 'msg-1792592221495-user');
    assert.notStrictEqual(d, null);
    assert.strictEqual(d.getTime(), 1792592221495);
  });

  test('Never produces "Invalid Date" for garbage input', () => {
    const d = parseMessageTimestamp('corrupted-string-xyz', null);
    assert.strictEqual(d, null);
    const str = formatTimestampDisplay(d, 'time');
    assert.strictEqual(str, '');
  });

  // TEST SUITE 3: Authoritative Message Reconciliation & Integrity
  console.log('\n--- 3. Message Reconciliation & Integrity ---');

  test('Preserves full history, correct order, and zero dropped messages', () => {
    const serverMsgs = [
      { id: 'msg-1', role: 'user', content: 'Turn 1 User' },
      { id: 'msg-2', role: 'assistant', content: 'Turn 1 Assistant' },
      { id: 'msg-3', role: 'user', content: 'Turn 2 User' },
      { id: 'msg-4', role: 'assistant', content: 'Turn 2 Assistant' }
    ];
    const clientMsgs = [
      { id: 'msg-1', role: 'user', content: 'Turn 1 User' },
      { id: 'msg-2', role: 'assistant', content: 'Turn 1 Assistant' }
    ];

    const reconciled = reconcileConversationMessages(serverMsgs, clientMsgs);
    assert.strictEqual(reconciled.length, 4);
    assert.strictEqual(reconciled[0].content, 'Turn 1 User');
    assert.strictEqual(reconciled[1].content, 'Turn 1 Assistant');
    assert.strictEqual(reconciled[2].content, 'Turn 2 User');
    assert.strictEqual(reconciled[3].content, 'Turn 2 Assistant');
  });

  test('Preserves client enrichments (generatedImage, attachments with dataUrl, researchSources)', () => {
    const serverMsgs = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Create a logo',
        attachments: [{ name: 'spec.png', size: 1024 }] // server lacks dataUrl
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here is your logo',
        modelId: 'flux-schnell' // server lacks generatedImage object
      }
    ];

    const clientMsgs = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Create a logo',
        attachments: [{ name: 'spec.png', size: 1024, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAA...' }]
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here is your logo',
        modelId: 'flux-schnell',
        generatedImage: {
          prompt: 'A futuristic cybernetic logo',
          imageDataUrl: 'data:image/png;base64,AABBCCDDEEFF...',
          modelName: 'FLUX.1 [schnell]'
        },
        researchSources: [
          { title: 'Vector Design Guidelines', url: 'https://example.com/vector', snippet: 'Best practices' }
        ]
      }
    ];

    const reconciled = reconcileConversationMessages(serverMsgs, clientMsgs);
    assert.strictEqual(reconciled.length, 2);

    // Verify user attachment dataUrl is retained
    assert.strictEqual(reconciled[0].attachments[0].dataUrl, 'data:image/png;base64,iVBORw0KGgoAAA...');

    // Verify generatedImage is preserved
    assert.notStrictEqual(reconciled[1].generatedImage, null);
    assert.strictEqual(reconciled[1].generatedImage.imageDataUrl, 'data:image/png;base64,AABBCCDDEEFF...');
    assert.strictEqual(reconciled[1].generatedImage.prompt, 'A futuristic cybernetic logo');

    // Verify researchSources are preserved
    assert.strictEqual(reconciled[1].researchSources.length, 1);
    assert.strictEqual(reconciled[1].researchSources[0].url, 'https://example.com/vector');
  });

  test('Captures in-progress streaming responses without dropping messages', () => {
    const serverMsgs = [
      { id: 'msg-1', role: 'user', content: 'Explain Quantum Computing' }
    ];
    // Client has ongoing streaming response
    const clientMsgs = [
      { id: 'msg-1', role: 'user', content: 'Explain Quantum Computing' },
      { id: 'msg-2-assistant', role: 'assistant', content: 'Quantum computing uses qubits which can exist in superposition...', isStreaming: true }
    ];

    const reconciled = reconcileConversationMessages(serverMsgs, clientMsgs);
    assert.strictEqual(reconciled.length, 2);
    assert.strictEqual(reconciled[1].id, 'msg-2-assistant');
    assert.strictEqual(reconciled[1].content.includes('superposition'), true);
  });

  test('Works cleanly when exporting archived chats from sidebar (empty client messages)', () => {
    const serverMsgs = [
      { id: 'msg-1', role: 'user', content: 'Archived turn 1' },
      { id: 'msg-2', role: 'assistant', content: 'Archived response 1' }
    ];
    const clientMsgs = []; // empty from sidebar

    const reconciled = reconcileConversationMessages(serverMsgs, clientMsgs);
    assert.strictEqual(reconciled.length, 2);
    assert.strictEqual(reconciled[0].content, 'Archived turn 1');
    assert.strictEqual(reconciled[1].content, 'Archived response 1');
  });

  test('Reconciles highlights without duplicates', () => {
    const serverHls = [
      { id: 'hl-1', messageId: 'msg-1', text: 'Important text', color: '#f59e0b' }
    ];
    const clientHls = [
      { id: 'hl-1', messageId: 'msg-1', text: 'Important text', color: '#f59e0b' },
      { id: 'hl-2', messageId: 'msg-2', text: 'Another highlight', color: '#10b981' }
    ];

    const reconciled = reconcileHighlights(serverHls, clientHls);
    assert.strictEqual(reconciled.length, 2);
  });

  // TEST SUITE 4: Markdown to Plain Text High-Fidelity Converter
  console.log('\n--- 4. Markdown to Plain Text Conversion ---');

  test('Strips markdown markers while preserving headings, lists, and code blocks', () => {
    const mdInput = `
# Executive Summary

Here is a paragraph with **bold text**, *italic emphasis*, and \`inline code\`.

### Key Features
* Feature 1: High performance
* Feature 2: Low latency
* Feature 3: Scalable

\`\`\`python
def calculate_metrics(data):
    return sum(data) / len(data)
\`\`\`

> Note: Always validate inputs before execution.

| Metric | Target | Actual |
| :--- | :--- | :--- |
| Latency | < 50ms | 18ms |
| Accuracy | > 99% | 99.4% |

Mathematical relation: $E = mc^2$ and $$\\sum_{i=1}^{n} x_i$$
`;

    const plain = convertMarkdownToPlainText(mdInput);
    assert.strictEqual(plain.includes('Executive Summary'), true);
    assert.strictEqual(plain.includes('# Executive Summary'), false); // no raw #
    assert.strictEqual(plain.includes('bold text'), true);
    assert.strictEqual(plain.includes('**bold text**'), false); // no **
    assert.strictEqual(plain.includes('• Feature 1: High performance'), true); // bullet converted to •
    assert.strictEqual(plain.includes('----- CODE BLOCK [PYTHON] -----'), true); // code block framed
    assert.strictEqual(plain.includes('def calculate_metrics(data):'), true);
    assert.strictEqual(plain.includes('| Note: Always validate inputs'), true); // blockquote converted
    assert.strictEqual(plain.includes('Latency  |  < 50ms  |  18ms'), true); // table formatted
    assert.strictEqual(plain.includes('E = mc^2'), true); // math preserved
  });

  // TEST SUITE 5: Full File Exports Across Formats (MD, TXT, HTML)
  console.log('\n--- 5. Full Export Pipeline (Markdown, Plain Text, Standalone HTML) ---');

  const testConv = {
    id: 'conv-test-999',
    title: 'Advanced AI Architecture & RAG Systems',
    modelId: 'gemini-3.5-flash'
  };

  const testMessages = [
    {
      id: 'msg-turn-1-u',
      role: 'user',
      content: 'Can you compare RAG with Fine-Tuning and give me a code example?',
      createdAt: '2026-10-21T10:00:00.000Z',
      attachments: [
        {
          name: 'system-diagram.png',
          type: 'image/png',
          formattedSize: '1.2 MB',
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        }
      ]
    },
    {
      id: 'msg-turn-1-a',
      role: 'assistant',
      modelName: 'Google Gemini 3.5 Flash',
      modelId: 'gemini-3.5-flash',
      createdAt: '2026-10-21T10:00:15.000Z',
      content: `### RAG vs Fine-Tuning Comparison

| Dimension | Retrieval-Augmented Generation (RAG) | Fine-Tuning |
| :--- | :--- | :--- |
| **Knowledge Updates** | Real-time via vector DB | Requires retraining |
| **Hallucination Risk** | Lower (grounded in retrieved docs) | Higher (parametric memory) |
| **Cost** | Embedding & Vector search costs | GPU training cluster costs |

\`\`\`python
# Vector search snippet
def query_vector_store(query_embedding, top_k=5):
    return vector_index.similarity_search(query_embedding, k=top_k)
\`\`\`

Key formula for cosine similarity:
$$ \\text{sim}(u, v) = \\frac{u \\cdot v}{\\|u\\| \\|v\\|} $$`,
      researchSources: [
        { title: 'Retrieval Augmented Generation for Knowledge-Intensive NLP Tasks (Lewis et al.)', url: 'https://arxiv.org/abs/2005.11401' }
      ]
    },
    {
      id: 'msg-turn-2-u',
      role: 'user',
      content: 'Generate a concept image for the vector search node.',
      createdAt: '2026-10-21T10:01:00.000Z'
    },
    {
      id: 'msg-turn-2-a',
      role: 'assistant',
      modelName: 'FLUX.1 [schnell]',
      modelId: 'flux-schnell',
      createdAt: '2026-10-21T10:01:08.000Z',
      content: 'Here is the 3D isometric representation of the vector search node in the neural network.',
      generatedImage: {
        prompt: 'Isometric glowing 3D vector database node with radiant neural connections',
        modelName: 'FLUX.1 [schnell]',
        imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    }
  ];

  const testHighlights = [
    {
      id: 'hl-test-1',
      messageId: 'msg-turn-1-a',
      text: 'Lower (grounded in retrieved docs)',
      color: '#10b981'
    }
  ];

  await asyncTest('exportToMarkdown creates valid Markdown file with all turns, images, and sources', async () => {
    const filename = await exportToMarkdown(testConv, testMessages, testHighlights);
    assert.strictEqual(filename.endsWith('.md'), true);
    assert.notStrictEqual(lastDownloadedBlob, null);

    // Read the blob text
    const mdContent = await lastDownloadedBlob.text();
    assert.strictEqual(mdContent.includes('# Advanced AI Architecture & RAG Systems'), true);
    assert.strictEqual(mdContent.includes('👤 User'), true);
    assert.strictEqual(mdContent.includes('🤖 Yash AI (Google Gemini 3.5 Flash)'), true);
    assert.strictEqual(mdContent.includes('🤖 Yash AI (FLUX.1 [schnell])'), true);
    assert.strictEqual(mdContent.includes('![system-diagram.png]('), true); // user attachment preserved
    assert.strictEqual(mdContent.includes('![Isometric glowing 3D vector database node'), true); // generated image preserved
    assert.strictEqual(mdContent.includes('#### 🌐 Verified Sources & Citations'), true); // research source preserved
    assert.strictEqual(mdContent.includes('https://arxiv.org/abs/2005.11401'), true);
    assert.strictEqual(mdContent.includes('```python'), true); // code block preserved
    assert.strictEqual(mdContent.includes('$$ \\text{sim}(u, v)'), true); // math preserved
    assert.strictEqual(mdContent.includes('<mark style="background-color:'), true); // highlight preserved
  });

  await asyncTest('exportToText creates structured plain text file with complete conversation', async () => {
    const filename = await exportToText(testConv, testMessages, testHighlights);
    assert.strictEqual(filename.endsWith('.txt'), true);
    assert.notStrictEqual(lastDownloadedBlob, null);

    const txtContent = await lastDownloadedBlob.text();
    assert.strictEqual(txtContent.includes('Title:          Advanced AI Architecture & RAG Systems'), true);
    assert.strictEqual(txtContent.includes('Total Messages: 4'), true);
    assert.strictEqual(txtContent.includes('[#1] USER'), true);
    assert.strictEqual(txtContent.includes('[#2] YASH AI (Google Gemini 3.5 Flash)'), true);
    assert.strictEqual(txtContent.includes('[#3] USER'), true);
    assert.strictEqual(txtContent.includes('[#4] YASH AI (FLUX.1 [schnell])'), true);
    assert.strictEqual(txtContent.includes('system-diagram.png (1.2 MB)'), true); // attachment noted
    assert.strictEqual(txtContent.includes('Prompt: "Isometric glowing 3D vector database node'), true); // generated image noted
    assert.strictEqual(txtContent.includes('Verified Web Sources:'), true); // sources noted
    assert.strictEqual(txtContent.includes('https://arxiv.org/abs/2005.11401'), true);
    assert.strictEqual(txtContent.includes('----- CODE BLOCK [PYTHON] -----'), true);
  });

  await asyncTest('exportToHtml creates valid, standalone, sanitized HTML document', async () => {
    const filename = await exportToHtml(testConv, testMessages, testHighlights);
    assert.strictEqual(filename.endsWith('.html'), true);
    assert.notStrictEqual(lastDownloadedBlob, null);

    const htmlContent = await lastDownloadedBlob.text();
    assert.strictEqual(htmlContent.includes('<!DOCTYPE html>'), true);
    assert.strictEqual(htmlContent.includes('<title>Advanced AI Architecture &amp; RAG Systems - Yash AI Export</title>'), true);
    assert.strictEqual(htmlContent.includes('class="message-card user-message"'), true);
    assert.strictEqual(htmlContent.includes('class="message-card assistant-message"'), true);
    assert.strictEqual(htmlContent.includes('class="attachment-item attachment-image"'), true);
    assert.strictEqual(htmlContent.includes('class="table-wrapper"'), true);
    assert.strictEqual(htmlContent.includes('class="code-container"'), true);
    assert.strictEqual(htmlContent.includes('class="math-block"'), true);
    assert.strictEqual(htmlContent.includes('class="message-sources"'), true);
    assert.strictEqual(htmlContent.includes('rgb-marker-highlight'), true);
  });

  // TEST SUITE 6: Stress & Edge Cases
  console.log('\n--- 6. Edge Cases & Multi-Turn Long Discussions ---');

  test('Handles 100-message multi-turn conversation with strict chronological ordering', () => {
    const longConversation = [];
    for (let i = 1; i <= 100; i++) {
      const isUser = i % 2 === 1;
      longConversation.push({
        id: `msg-${i}`,
        role: isUser ? 'user' : 'assistant',
        content: `Message ${i}: ${isUser ? 'Question about algorithms' : 'Detailed algorithmic explanation and computational complexity O(n log n).'}`
      });
    }

    const reconciled = reconcileConversationMessages(longConversation, longConversation);
    assert.strictEqual(reconciled.length, 100);
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(reconciled[i].id, `msg-${i + 1}`);
    }
  });

  test('Handles empty chat without crashing or throwing', () => {
    const emptyConv = { id: 'conv-empty', title: 'Empty Chat' };
    const reconciled = reconcileConversationMessages([], []);
    assert.strictEqual(reconciled.length, 0);

    const plain = convertMarkdownToPlainText('');
    assert.strictEqual(plain, '');

    const html = buildStandaloneHtml(emptyConv, []);
    assert.strictEqual(html.includes('Messages:</strong> 0'), true);
  });

  test('Preserves Indian language content, Devanagari script, and emojis in Markdown & Text', async () => {
    const indianConv = {
      id: 'conv-hindi-01',
      title: 'कृत्रिम बुद्धिमत्ता और मशीन लर्निंग',
      modelId: 'gemini-2.5-flash'
    };
    const indianMsgs = [
      {
        id: 'msg-h1',
        role: 'user',
        content: 'मशीन लर्निंग क्या है? संक्षेप में समझाइए। 🤖',
        createdAt: '2026-10-21T12:00:00.000Z'
      },
      {
        id: 'msg-h2',
        role: 'assistant',
        modelName: 'Google Gemini 2.5 Flash',
        content: 'मशीन लर्निंग (Machine Learning) कृत्रिम बुद्धिमत्ता (AI) का एक महत्वपूर्ण हिस्सा है।\n\n1. सुपरवाइज़्ड लर्निंग (Supervised Learning)\n2. अनसुपरवाइज़्ड लर्निंग (Unsupervised Learning)\n3. रीइन्फोर्समेंट लर्निंग (Reinforcement Learning) 🚀',
        createdAt: '2026-10-21T12:00:10.000Z'
      }
    ];

    const mdFilename = await exportToMarkdown(indianConv, indianMsgs);
    const mdText = await lastDownloadedBlob.text();
    assert.strictEqual(mdText.includes('मशीन लर्निंग क्या है?'), true);
    assert.strictEqual(mdText.includes('सुपरवाइज़्ड लर्निंग'), true);
    assert.strictEqual(mdText.includes('🤖'), true);
    assert.strictEqual(mdText.includes('🚀'), true);

    const txtFilename = await exportToText(indianConv, indianMsgs);
    const plainText = await lastDownloadedBlob.text();
    assert.strictEqual(plainText.includes('मशीन लर्निंग क्या है?'), true);
    assert.strictEqual(plainText.includes('1. सुपरवाइज़्ड लर्निंग'), true);
  });

  test('Multi-model conversation preserves distinct model names and badges across all turns', async () => {
    const multiModelMsgs = [
      {
        id: 'm1',
        role: 'user',
        content: 'Draft a short technical description.'
      },
      {
        id: 'm2',
        role: 'assistant',
        modelName: 'Meta Llama 3.3 70B (Groq)',
        modelId: 'llama-3.3-70b',
        content: 'Llama 3.3 technical analysis completed.'
      },
      {
        id: 'm3',
        role: 'user',
        content: 'Now generate a diagram.'
      },
      {
        id: 'm4',
        role: 'assistant',
        modelName: 'FLUX.1 [schnell]',
        modelId: 'flux-schnell',
        content: 'Visual blueprint rendered.',
        generatedImage: {
          prompt: 'System architecture diagram',
          imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        }
      }
    ];

    const conv = { id: 'conv-multi', title: 'Multi Model Pipeline' };
    await exportToMarkdown(conv, multiModelMsgs);
    const md = await lastDownloadedBlob.text();
    assert.strictEqual(md.includes('🤖 Yash AI (Meta Llama 3.3 70B (Groq))'), true);
    assert.strictEqual(md.includes('🤖 Yash AI (FLUX.1 [schnell])'), true);
    assert.strictEqual(md.includes('System architecture diagram'), true);

    await exportToHtml(conv, multiModelMsgs);
    const html = await lastDownloadedBlob.text();
    assert.strictEqual(html.includes('Meta Llama 3.3 70B (Groq)'), true);
    assert.strictEqual(html.includes('FLUX.1 [schnell]'), true);
  });

  test('Rapid message sending simulation: client messages ahead of server are safely retained', () => {
    const serverMsgs = [
      { id: 'm1', role: 'user', content: 'Initial question' },
      { id: 'm2', role: 'assistant', content: 'Initial answer' }
    ];
    // User rapidly sent m3 and m4 while m4 is streaming
    const clientMsgs = [
      { id: 'm1', role: 'user', content: 'Initial question' },
      { id: 'm2', role: 'assistant', content: 'Initial answer' },
      { id: 'm3', role: 'user', content: 'Rapid follow-up question' },
      { id: 'm4', role: 'assistant', content: 'Streaming in-flight answer...', isStreaming: true }
    ];

    const reconciled = reconcileConversationMessages(serverMsgs, clientMsgs);
    assert.strictEqual(reconciled.length, 4);
    assert.strictEqual(reconciled[2].content, 'Rapid follow-up question');
    assert.strictEqual(reconciled[3].content, 'Streaming in-flight answer...');
  });

  console.log('\n================================================================================');
  console.log(`RESULTS: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================================\n');

  if (passed === total) {
    console.log('✨ All conversation export pipeline tests PASSED successfully!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
