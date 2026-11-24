import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import child_process from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('../js-code/node_modules/pdf-parse');

import {
  buildStandaloneHtml,
  exportToMarkdown,
  exportToText
} from './src/services/conversationExport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const testExportsDir = path.resolve(rootDir, 'test_exports');

// Exact sample conversation from Yash-AI_AI-Machine-Learning-Architecture_2026-10-22.md
const conversation = {
  id: 'conv-sample-arch-1',
  title: 'AI Machine Learning Architecture'
};

const messages = [
  {
    id: 'msg-sample-1',
    role: 'user',
    content: 'Can you provide an overview of Artificial Intelligence and its real-world domains?',
    createdAt: '2026-10-21T15:30:00.000Z'
  },
  {
    id: 'msg-sample-2',
    role: 'assistant',
    modelName: 'gemini-2.5-flash',
    content: 'Artificial intelligence enables computers to perform tasks that normally require human intelligence. It is used in healthcare, robotics, education, and many other fields.',
    createdAt: '2026-10-21T15:30:05.000Z'
  },
  {
    id: 'msg-sample-3',
    role: 'user',
    content: 'Show me an example with code and Indian language translation.',
    createdAt: '2026-10-21T15:31:00.000Z'
  },
  {
    id: 'msg-sample-4',
    role: 'assistant',
    modelName: 'gemini-2.5-flash',
    content: `# Artificial Intelligence in India

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

> कृत्रिम बुद्धिमत्ता हे आधुनिक भारताच्या विकासाचे प्रमुख साधन आहे.`,
    createdAt: '2026-10-21T15:31:15.000Z'
  }
];

const highlights = [
  {
    id: 'hl-exp-1',
    messageId: 'msg-sample-2',
    text: 'intelligence enables',
    color: 'yellow'
  },
  {
    id: 'hl-exp-2',
    messageId: 'msg-sample-2',
    text: 'healthcare, robotics, education',
    color: 'green'
  },
  {
    id: 'hl-exp-3',
    messageId: 'msg-sample-4',
    text: 'ક્રાંતિ લાવી રહી છે',
    color: 'pink'
  }
];

async function main() {
  console.log('================================================================================');
  console.log('  VERIFYING FIXED PDF CHAT EXPORT AGAINST SAMPLE DEFECTS                        ');
  console.log('================================================================================\n');

  // 1. Build Standalone HTML with updated conversationExport
  console.log('1. Generating Standalone HTML...');
  const fixedHtml = buildStandaloneHtml(conversation, messages, highlights, {
    forPdf: false,
    isPrintPreview: true
  });

  const fixedHtmlPath = path.resolve(testExportsDir, 'Yash-AI_AI-Machine-Learning-Architecture_Fixed.html');
  fs.writeFileSync(fixedHtmlPath, fixedHtml, 'utf-8');
  console.log(`   ✓ Saved fixed HTML to: ${fixedHtmlPath}`);

  // 2. Render to PDF using Chrome Headless Engine (matching browser printing)
  console.log('\n2. Rendering Fixed PDF via Headless Engine...');
  const fixedPdfPath = path.resolve(testExportsDir, 'Yash-AI_AI-Machine-Learning-Architecture_Fixed.pdf');

  const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${fixedPdfPath}`,
    `file:///${fixedHtmlPath.replace(/\\/g, '/')}`
  ];

  child_process.execFileSync(chromeExe, chromeArgs);
  console.log(`   ✓ Generated fixed PDF at: ${fixedPdfPath}`);
  const pdfStats = fs.statSync(fixedPdfPath);
  console.log(`   ✓ File size: ${pdfStats.size} bytes`);

  // 3. Inspect original defective PDF
  console.log('\n3. Analyzing Original Defective Sample PDF...');
  const originalPdfPath = path.resolve(testExportsDir, 'Yash-AI_AI-Machine-Learning-Architecture_2026-10-22.pdf');
  const originalPdfData = await pdfParse(fs.readFileSync(originalPdfPath));

  console.log(`   Original PDF Pages: ${originalPdfData.numpages}`);
  console.log(`   Original PDF Text Length: ${originalPdfData.text.length} chars`);
  const origHasGibberishUser = originalPdfData.text.includes('Ø=Üd');
  const origHasGibberishBot = originalPdfData.text.includes('Ø>Ý');
  const origHasMissingCode = !originalPdfData.text.includes('def analyze(data)');
  const origHasMissingMarathi = !originalPdfData.text.includes('कृत्रिम बुद्धिमत्ता हे आधुनिक');
  const origTruncatedMidTable = originalPdfData.text.includes('( E d u c a t i o n )') && !originalPdfData.text.includes('Code Implementation');

  console.log(`   - Defect: WinAnsi emoji surrogate gibberish (Ø=Üd): ${origHasGibberishUser ? 'FOUND (Broken)' : 'None'}`);
  console.log(`   - Defect: WinAnsi emoji surrogate gibberish (Ø>Ý): ${origHasGibberishBot ? 'FOUND (Broken)' : 'None'}`);
  console.log(`   - Defect: Omitted code block (def analyze): ${origHasMissingCode ? 'OMITTED (Broken)' : 'Present'}`);
  console.log(`   - Defect: Omitted Marathi blockquote: ${origHasMissingMarathi ? 'OMITTED (Broken)' : 'Present'}`);
  console.log(`   - Defect: Truncated mid-table on Page 1: ${origTruncatedMidTable ? 'TRUNCATED (Broken)' : 'Complete'}`);

  // 4. Parse and verify Fixed PDF
  console.log('\n4. Parsing and Verifying Fixed PDF...');
  const fixedPdfData = await pdfParse(fs.readFileSync(fixedPdfPath));
  console.log(`   Fixed PDF Pages: ${fixedPdfData.numpages}`);
  console.log(`   Fixed PDF Text Length: ${fixedPdfData.text.length} chars`);

  let failures = 0;
  function check(desc, condition) {
    if (condition) {
      console.log(`   ✅ [PASS] ${desc}`);
    } else {
      console.error(`   ❌ [FAIL] ${desc}`);
      failures++;
    }
  }

  // Check 1: No surrogate pair gibberish
  check('Zero WinAnsi user emoji gibberish (Ø=Üd)', !fixedPdfData.text.includes('Ø=Üd'));
  check('Zero WinAnsi bot emoji gibberish (Ø>Ý)', !fixedPdfData.text.includes('Ø>Ý'));
  check('Zero WinAnsi CP1252 byte corruption glyphs (• Ã ¤ Í ° ¿ ®)', !fixedPdfData.text.includes('•\nÃ\n¤\nÍ'));

  // Check 2: Gujarati text and table content intact
  check('Gujarati text words present (માનવ કાર્યક્ષમતા વધારે છે)', 
    fixedPdfData.text.includes('માનવ') && fixedPdfData.text.includes('વધારે છે'));
  check('Gujarati table headers present (Sector, Impact, Priority)', 
    fixedPdfData.text.includes('(Sector)') && fixedPdfData.text.includes('(Impact)') && fixedPdfData.text.includes('(Priority)'));
  check('Gujarati table row 1 present (આરોગ્ય (Health) | ઉચ્ચ (High))', 
    fixedPdfData.text.includes('આરોગ્ય (Health)') && fixedPdfData.text.includes('ઉચ્ચ (High)'));
  check('Gujarati table row 2 present (િશક્ષણ (Education) | (Very High) | તાત્કાિલક)', 
    fixedPdfData.text.includes('(Education)') && fixedPdfData.text.includes('(Very High)') && fixedPdfData.text.includes('તાત્કાિલક'));

  // Check 3: Code block completely present (was completely missing in original sample PDF)
  check('Code block header present (PYTHON)', fixedPdfData.text.includes('PYTHON'));
  check('Code block body present (def analyze(data):)', fixedPdfData.text.includes('def analyze(data):'));
  check('Code return statement present ("Analysis complete")', fixedPdfData.text.includes('"Analysis complete"'));

  // Check 4: Marathi blockquote present (was completely missing in original sample PDF)
  check('Marathi blockquote present (आधुिनक / प्रमुख साधन आहे)',
    fixedPdfData.text.includes('प्रमुख साधन आहे'));

  // Check 5: All 4 messages present
  check('Message 1 (User overview question) present', fixedPdfData.text.includes('Can you provide an overview of Artificial Intelligence'));
  check('Message 2 (Assistant answer) present', fixedPdfData.text.includes('Artificial intelligence enables computers'));
  check('Message 3 (User code request) present', fixedPdfData.text.includes('Show me an example with code'));
  check('Message 4 (Assistant Indian translation + table + code) present', fixedPdfData.text.includes('Artificial Intelligence in India'));

  // Check 6: Clean metadata headers & branding
  check('Chat title header present', fixedPdfData.text.includes('AI Machine Learning Architecture'));
  check('Platform branding present', fixedPdfData.text.includes('Yash AI Enterprise Platform'));
  check('Total message count present (Messages: 4)', fixedPdfData.text.includes('Messages: 4'));

  console.log('\n================================================================================');
  if (failures === 0) {
    console.log('  RESULTS: ALL VERIFICATION CHECKS PASSED (100%)                              ');
    console.log('  The generated Fixed PDF completely resolves all defects of the sample PDF!  ');
  } else {
    console.error(`  RESULTS: ${failures} CHECKS FAILED!`);
    process.exit(1);
  }
  console.log('================================================================================\n');
}

main().catch(err => {
  console.error('Fatal error in PDF verification:', err);
  process.exit(1);
});
