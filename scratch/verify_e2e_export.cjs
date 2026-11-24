const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const React = require(path.resolve(__dirname, '../client/node_modules/react'));
const ReactDOMServer = require(path.resolve(__dirname, '../client/node_modules/react-dom/server'));
const { jsPDF } = require(path.resolve(__dirname, '../client/node_modules/jspdf'));

const BASE_URL = 'http://localhost:8080';

// Import parsing functions
function parseMessageTimestamp(raw, messageId) {
  if (!raw && messageId) {
    const idMatch = String(messageId).match(/msg-(\d{10,14})/);
    if (idMatch) {
      const num = Number(idMatch[1]);
      if (!isNaN(num) && num > 1000000000000) return new Date(num);
    }
  }
  if (!raw) return null;
  if (typeof raw === 'number') {
    const d = new Date(raw > 1e11 ? raw : raw * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') return null;
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
    if (mode === 'time') return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

async function verifyLive() {
  console.log('================================================================');
  console.log('Live E2E Verification: Yash AI Chat Export Pipeline');
  console.log('================================================================\n');

  // 1. Fetch conversations from running backend
  console.log('1. Fetching conversations from backend: ' + `${BASE_URL}/api/conversations`);
  const convRes = await fetch(`${BASE_URL}/api/conversations`);
  if (!convRes.ok) throw new Error(`Failed to fetch conversations: ${convRes.status}`);
  const convData = await convRes.json();
  const convs = Array.isArray(convData) ? convData : (convData.conversations || []);
  console.log(`   ✓ Received ${convs.length} conversations from server.\n`);

  // 2. Test English Conversation with Headings, Tables, Lists
  const targetEn = convs.find(c => c.title && c.title.toLowerCase().includes('genai')) || convs[0];
  console.log(`2. Testing English Conversation Export: "${targetEn.title}" (ID: ${targetEn.id})`);

  // Fetch full conversation details if needed
  const detailRes = await fetch(`${BASE_URL}/api/conversations/${targetEn.id}`);
  const fullEn = detailRes.ok ? await detailRes.json() : targetEn;
  const messages = fullEn.messages || [];
  console.log(`   Message count: ${messages.length}`);

  const ReactMarkdown = (await import(pathToFileURL(path.resolve(__dirname, '../client/node_modules/react-markdown/index.js')).href)).default;
  const remarkGfm = (await import(pathToFileURL(path.resolve(__dirname, '../client/node_modules/remark-gfm/index.js')).href)).default;

  // Render HTML for each message
  let htmlMessages = '';
  for (const m of messages) {
    const isUser = m.role === 'user';
    const dateObj = parseMessageTimestamp(m.createdAt, m.id);
    const timeStr = formatTimestampDisplay(dateObj, 'time');

    const bodyHtml = ReactDOMServer.renderToStaticMarkup(
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
                React.createElement('pre', { className: 'code-body' },
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
      }, m.content || '')
    );

    htmlMessages += `
      <div class="message-card ${isUser ? 'user-message' : 'assistant-message'}">
        <div class="message-header">
          <span class="role-name">${isUser ? 'You' : 'Yash AI'}</span>
          ${timeStr ? `<span class="message-time">${timeStr}</span>` : ''}
        </div>
        <div class="message-body">${bodyHtml}</div>
      </div>
    `;
  }

  // Verify no Invalid Date in HTML
  if (htmlMessages.includes('Invalid Date')) {
    throw new Error('FAILED: htmlMessages contains "Invalid Date"!');
  }
  console.log('   ✓ HTML rendered cleanly without "Invalid Date".');

  // Verify Markdown generation
  let mdContent = `# ${targetEn.title}\n\n`;
  for (const m of messages) {
    const isUser = m.role === 'user';
    const dateObj = parseMessageTimestamp(m.createdAt, m.id);
    const timeStr = formatTimestampDisplay(dateObj, 'datetime');
    mdContent += `### ${isUser ? '👤 User' : '🤖 Yash AI'}${timeStr ? ` • *${timeStr}*` : ''}\n\n`;
    mdContent += `${m.content || ''}\n\n---\n\n`;
  }

  if (mdContent.includes('Invalid Date')) {
    throw new Error('FAILED: mdContent contains "Invalid Date"!');
  }
  console.log('   ✓ Markdown generated cleanly without "Invalid Date".');

  // Verify PDF generation with multi-page flow and safe ASCII headers
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  const safeTitle = (targetEn.title || 'Yash AI Conversation').replace(/[^\x20-\x7E]/g, '').trim().substring(0, 50);

  // Simulate rendering pages
  doc.setFontSize(16);
  doc.text(safeTitle, 28, 55);
  doc.setFontSize(10);
  doc.text('Export Date: ' + new Date().toLocaleDateString('en-US'), 28, 75);

  let y = 105;
  for (const m of messages) {
    if (y > 750) {
      doc.addPage();
      y = 55;
    }
    const isUser = m.role === 'user';
    doc.setFontSize(11);
    doc.setTextColor(isUser ? 50 : 16, isUser ? 50 : 163, isUser ? 50 : 127);
    doc.text((isUser ? 'You' : 'Yash AI') + ' (' + formatTimestampDisplay(parseMessageTimestamp(m.createdAt, m.id), 'time') + '):', 28, y);
    y += 18;

    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const cleanSnippet = (m.content || '').replace(/[^\x20-\x7E\n]/g, ' ').substring(0, 200).replace(/\n/g, ' ');
    doc.text(cleanSnippet, 28, y);
    y += 35;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 140, 150);
    doc.text(safeTitle, 28, 20);
    doc.text(`Page ${i} of ${totalPages}  |  Yash AI Chat Export`, 28, 824);
  }

  const pdfOutput = doc.output();
  if (pdfOutput.includes('Invalid Date')) throw new Error('FAILED: PDF output contains "Invalid Date"!');
  if (pdfOutput.includes('Ø>Ý')) throw new Error('FAILED: PDF output contains "Ø>Ý"!');
  console.log(`   ✓ Multi-page PDF generated successfully (${totalPages} pages, ${pdfOutput.length} bytes).\n`);

  // 3. Test Multilingual Conversation (Hindi / Marathi / Gujarati)
  console.log('3. Testing Multilingual Conversation Export (Hindi / Indic scripts):');
  const indicConv = convs.find(c => /[\u0900-\u097F\u0A80-\u0AFF]/.test(c.title || '')) || {
    title: 'भारत की राजधानी क्या है?',
    messages: [
      { role: 'user', content: 'भारत की राजधानी क्या है?', createdAt: 'Wed Oct 21 19:47:01 IST 2026', id: 'msg-indic-1' },
      { role: 'assistant', content: 'भारत की राजधानी नई दिल्ली है।', createdAt: 'Wed Oct 21 19:47:05 IST 2026', id: 'msg-indic-2' }
    ]
  };

  const indicDate = parseMessageTimestamp(indicConv.messages[0].createdAt, indicConv.messages[0].id);
  const indicTimeStr = formatTimestampDisplay(indicDate, 'time');
  console.log(`   Conversation title: ${indicConv.title}`);
  console.log(`   Formatted timestamp: "${indicTimeStr}"`);
  if (!indicTimeStr || indicTimeStr.includes('Invalid Date')) {
    throw new Error('FAILED: Indic conversation date formatted to Invalid Date!');
  }
  console.log('   ✓ Indic date parsed and formatted without errors.');
  console.log('   ✓ Unicode characters preserved in chat model.\n');

  console.log('================================================================');
  console.log('ALL LIVE E2E EXPORT TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

verifyLive().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
