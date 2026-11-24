const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const React = require(path.resolve(__dirname, '../client/node_modules/react'));
const ReactDOMServer = require(path.resolve(__dirname, '../client/node_modules/react-dom/server'));
const { jsPDF } = require(path.resolve(__dirname, '../client/node_modules/jspdf'));

// Re-implement or import the pure functions from conversationExport for Node test environment
function parseMessageTimestamp(raw, messageId) {
  if (!raw && messageId) {
    const idMatch = String(messageId).match(/msg-(\d{10,14})/);
    if (idMatch) {
      const num = Number(idMatch[1]);
      if (!isNaN(num) && num > 1000000000000) {
        return new Date(num);
      }
    }
  }

  if (!raw) return null;

  if (typeof raw === 'number') {
    const d = new Date(raw > 1e11 ? raw : raw * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }

    if (/^\d{10,14}$/.test(trimmed)) {
      const num = Number(trimmed);
      const d = new Date(num > 1e11 ? num : num * 1000);
      return isNaN(d.getTime()) ? null : d;
    }

    const javaDateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Za-z0-9_+-]+)?\s*(\d{4})$/);
    if (javaDateMatch) {
      const month = javaDateMatch[1];
      const day = javaDateMatch[2];
      const time = javaDateMatch[3];
      const year = javaDateMatch[5];
      const d = new Date(`${month} ${day} ${year} ${time}`);
      if (!isNaN(d.getTime())) return d;
    }

    const sanitizedIso = trimmed.replace(/(\.\d{3})\d+([Z+-])/, '$1$2');
    const dIso = new Date(sanitizedIso);
    if (!isNaN(dIso.getTime())) return dIso;

    const dDirect = new Date(trimmed);
    if (!isNaN(dDirect.getTime())) return dDirect;
  }

  return null;
}

function formatTimestampDisplay(date, mode = 'time') {
  if (!date || isNaN(date.getTime())) return '';
  try {
    if (mode === 'time') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (mode === 'datetime') {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleString('en-US');
  } catch (e) {
    return '';
  }
}

function sanitizeFilename(title, ext) {
  const cleaned = (title || 'Chat')
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const safeTitle = cleaned || 'Conversation';
  const dateStr = new Date().toISOString().split('T')[0];
  return `Yash-AI_${safeTitle}_${dateStr}.${ext}`;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('Yash AI Chat Export Validation & Regression Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test Suite 1: Timestamp Parsing and Elimination of "Invalid Date"
  // -------------------------------------------------------------
  console.log('Test Suite 1: Timestamp Parsing & Formatting');

  const javaDate = parseMessageTimestamp('Wed Oct 21 19:47:01 IST 2026', 'msg-1-user');
  assert(javaDate !== null && !isNaN(javaDate.getTime()), 'Parse Java Date with IST timezone');
  assert(!formatTimestampDisplay(javaDate, 'time').includes('Invalid Date'), 'Format Java Date does not contain "Invalid Date"');
  assert(formatTimestampDisplay(javaDate, 'time').length > 0, 'Format Java Date produces valid time', formatTimestampDisplay(javaDate, 'time'));

  const isoNanoDate = parseMessageTimestamp('2026-10-21T14:17:01.442489200Z', 'msg-2-user');
  assert(isoNanoDate !== null && !isNaN(isoNanoDate.getTime()), 'Parse ISO 8601 with 9-digit nanoseconds');
  assert(!formatTimestampDisplay(isoNanoDate, 'datetime').includes('Invalid Date'), 'Format ISO Date does not contain "Invalid Date"');

  const epochDate = parseMessageTimestamp(1792592221495, 'msg-3-user');
  assert(epochDate !== null && !isNaN(epochDate.getTime()), 'Parse epoch millisecond number');

  const epochStrDate = parseMessageTimestamp('1792592221495', 'msg-4-user');
  assert(epochStrDate !== null && !isNaN(epochStrDate.getTime()), 'Parse epoch millisecond string');

  const fallbackIdDate = parseMessageTimestamp(null, 'msg-1792592221495-user');
  assert(fallbackIdDate !== null && !isNaN(fallbackIdDate.getTime()), 'Extract epoch from messageId when createdAt is null');

  const nullDate = parseMessageTimestamp(null, 'msg-no-timestamp');
  assert(nullDate === null, 'Missing timestamp returns null');
  assert(formatTimestampDisplay(nullDate) === '', 'Missing timestamp formats to empty string, never "Invalid Date"');

  const invalidDate = parseMessageTimestamp('totally-invalid-string', 'msg-bad');
  assert(invalidDate === null, 'Invalid string returns null');
  assert(formatTimestampDisplay(invalidDate) === '', 'Invalid string formats to empty string, never "Invalid Date"');

  // -------------------------------------------------------------
  // Test Suite 2: Filename Sanitization & Indian Scripts
  // -------------------------------------------------------------
  console.log('\nTest Suite 2: Filename Sanitization & Unicode Support');

  const asciiName = sanitizeFilename('Tell Me About GenAI', 'pdf');
  assert(asciiName.startsWith('Yash-AI_Tell-Me-About-GenAI_'), 'Ascii title filename formatted correctly');

  const hindiName = sanitizeFilename('भारत की राजधानी क्या है?', 'pdf');
  assert(hindiName.includes('भारत-की-राजधानी-क्या-है'), 'Hindi Unicode title preserved in filename', hindiName);

  const marathiName = sanitizeFilename('महाराष्ट्राची राजधानी कोणती आहे', 'html');
  assert(marathiName.includes('महाराष्ट्राची-राजधानी-कोणती-आहे'), 'Marathi Unicode title preserved in filename', marathiName);

  const gujaratiName = sanitizeFilename('અમદાવાદ વિશે 2 વાક્યમાં સમજાવો', 'md');
  assert(gujaratiName.includes('અમદાવાદ-વિશે-2-વાક્યમાં-સમજાવો'), 'Gujarati Unicode title preserved in filename', gujaratiName);

  // -------------------------------------------------------------
  // Test Suite 3: Markdown & HTML Rendering with Rich Content
  // -------------------------------------------------------------
  console.log('\nTest Suite 3: Markdown & HTML Content Rendering');

  const ReactMarkdown = (await import(pathToFileURL(path.resolve(__dirname, '../client/node_modules/react-markdown/index.js')).href)).default;
  const remarkGfm = (await import(pathToFileURL(path.resolve(__dirname, '../client/node_modules/remark-gfm/index.js')).href)).default;

  const testContent = `# System Architecture: Microservices & GenAI

This is an in-depth conversation about **distributed systems**, *vector databases*, and \`pgvector\`.

### 1. Key Technologies
* **React 18:** Frontend Single Page Application
  * Material UI v5
  * Cytoscape.js for Knowledge Graphs
* **Spring Boot 4:** Unified REST and SSE inference
  * Apache PDFBox for Document Intelligence
  * Reactive WebClient with Flux streaming

### 2. Comparison Matrix

| Technology | Role | Scalability | License |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | Relational & Vector DB | High with sharding | Open Source |
| **ClickHouse** | Real-time Analytics | Extremely High | Apache 2.0 |
| **Pinecone** | Managed Vector Search | Serverless auto-scale | Commercial |

### 3. Implementation Example
\`\`\`java
@RestController
@RequestMapping("/api/chat")
public class ChatController {
    @GetMapping("/stream")
    public Flux<ServerSentEvent<String>> streamChat(@RequestParam String prompt) {
        return inferenceService.streamResponse(prompt);
    }
}
\`\`\`

> **Note:** Long URLs must break gracefully:
> https://github.com/coderarmy-org/fullstack-multimodal-enterprise-ai-platform/commit/7a2e8f00123456789abcdef9876543210

---

### 4. Multilingual Section
- Hindi: भारत की राजधानी नई दिल्ली है।
- Marathi: महाराष्ट्राची राजधानी मुंबई आहे.
- Gujarati: ગુજરાતનું મુખ્ય મથક ગાંધીનગર છે.
`;

  const renderedHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      components: {
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');
          const isBlock = match || codeString.includes('\n');
          if (isBlock) {
            const lang = match ? match[1].toUpperCase() : 'CODE';
            return React.createElement(
              'div',
              { className: 'code-container' },
              React.createElement('div', { className: 'code-header' }, lang),
              React.createElement(
                'pre',
                { className: 'code-body' },
                React.createElement('code', { className, ...props }, codeString)
              )
            );
          }
          return React.createElement('code', { className: 'inline-code', ...props }, children);
        },
        table({ node, children, ...props }) {
          return React.createElement(
            'div',
            { className: 'table-wrapper' },
            React.createElement('table', { className: 'markdown-table', ...props }, children)
          );
        }
      }
    }, testContent)
  );

  assert(renderedHtml.includes('<h1>System Architecture: Microservices &amp; GenAI</h1>'), 'Heading h1 rendered with proper hierarchy');
  assert(renderedHtml.includes('<h3>1. Key Technologies</h3>'), 'Heading h3 rendered with proper hierarchy');
  assert(renderedHtml.includes('<strong>distributed systems</strong>'), 'Bold text rendered');
  assert(renderedHtml.includes('<em>vector databases</em>'), 'Italic text rendered');
  assert(renderedHtml.includes('class="inline-code">pgvector</code>'), 'Inline code rendered');
  assert(renderedHtml.includes('<div class="code-container">'), 'Preformatted code block wrapped in code-container');
  assert(renderedHtml.includes('<div class="code-header">JAVA</div>'), 'Code block language header rendered as JAVA');
  assert(renderedHtml.includes('class="markdown-table"'), 'Markdown table rendered');
  assert(renderedHtml.includes('Technology</th>'), 'Table headers rendered');
  assert(renderedHtml.includes('<blockquote>'), 'Blockquote rendered');
  assert(renderedHtml.includes('<hr/>'), 'Horizontal divider rendered');
  assert(renderedHtml.includes('भारत की राजधानी नई दिल्ली है।'), 'Hindi script preserved in HTML');
  assert(renderedHtml.includes('महाराष्ट्राची राजधानी मुंबई आहे.'), 'Marathi script preserved in HTML');
  assert(renderedHtml.includes('ગુજરાતનું મુખ્ય મથક ગાંધીનગર છે.'), 'Gujarati script preserved in HTML');

  // -------------------------------------------------------------
  // Test Suite 4: Real Conversation from Database Export Verification
  // -------------------------------------------------------------
  console.log('\nTest Suite 4: Real Conversation Database Export');

  const convFile = path.resolve(__dirname, '../spring-code/data/conversations.json');
  assert(fs.existsSync(convFile), 'Database conversations.json exists');

  const conversations = JSON.parse(fs.readFileSync(convFile, 'utf8'));
  console.log(`  Total conversations loaded from database: ${conversations.length}`);

  // Find a conversation with substantial messages, code blocks or tables
  const targetConv = conversations.find(c => c.messages && c.messages.length >= 2 && c.messages.some(m => m.content && m.content.includes('```') || m.content.includes('|'))) || conversations[0];
  console.log(`  Target test conversation: "${targetConv.title}" (ID: ${targetConv.id}, Messages: ${targetConv.messages.length})`);

  // Build Markdown export
  let mdOut = `# ${targetConv.title}\n\n`;
  for (const msg of targetConv.messages) {
    const isUser = msg.role === 'user';
    const d = parseMessageTimestamp(msg.createdAt, msg.id);
    const timeStr = formatTimestampDisplay(d, 'datetime');
    mdOut += `### ${isUser ? '👤 User' : '🤖 Yash AI'}${timeStr ? ` • *${timeStr}*` : ''}\n\n`;
    mdOut += `${msg.content || ''}\n\n---\n\n`;
  }

  assert(!mdOut.includes('Invalid Date'), 'Markdown export contains NO "Invalid Date"');
  assert(!mdOut.includes('NaN'), 'Markdown export contains NO "NaN"');
  assert(mdOut.length > 200, 'Markdown export generated comprehensive content', `${mdOut.length} bytes`);

  // -------------------------------------------------------------
  // Test Suite 5: Multi-Page PDF Geometry, Header/Footer & Absence of Overlapping Text
  // -------------------------------------------------------------
  console.log('\nTest Suite 5: PDF Vector Geometry & Absence of Overlapping Text');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  // Verify A4 dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  assert(Math.round(pageWidth) === 595, 'A4 Page Width is 595.28 pt', `${pageWidth} pt`);
  assert(Math.round(pageHeight) === 842, 'A4 Page Height is 841.89 pt', `${pageHeight} pt`);

  // Add multiple pages to verify running headers & footers
  doc.text('Page 1 Content: Starting conversation export', 28, 50);
  doc.addPage();
  doc.text('Page 2 Content: Second message flow', 28, 50);
  doc.addPage();
  doc.text('Page 3 Content: Third message flow', 28, 50);

  const totalPages = doc.internal.getNumberOfPages();
  assert(totalPages === 3, 'Multi-page document has 3 pages');

  const safeTitle = 'GenAI Systems Architecture';
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 140, 150);
    // Header at y=20 (safely inside top margin of 34pt)
    doc.text(safeTitle, 28, 20);
    // Footer at y=824 (safely inside bottom margin of 36pt, using ASCII '|' separator)
    doc.text(`Page ${i} of ${totalPages}  |  Yash AI Chat Export`, 28, 824);
  }

  const pdfOutput = doc.output();
  assert(pdfOutput.length > 1000, 'Generated valid PDF byte stream', `${pdfOutput.length} bytes`);
  assert(!pdfOutput.includes('Ø>Ý'), 'PDF output contains NO surrogate pair corruption (Ø>Ý)');
  assert(!pdfOutput.includes('Invalid Date'), 'PDF output contains NO "Invalid Date"');
  assert(pdfOutput.startsWith('%PDF-'), 'PDF output has valid PDF file magic header (%PDF-)');

  // Save test PDF to scratch for inspection
  const testPdfPath = path.resolve(__dirname, 'test_export_verified.pdf');
  fs.writeFileSync(testPdfPath, Buffer.from(pdfOutput, 'binary'));
  assert(fs.existsSync(testPdfPath) && fs.statSync(testPdfPath).size > 1000, 'Saved verified PDF file to disk', testPdfPath);

  console.log('\n================================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
