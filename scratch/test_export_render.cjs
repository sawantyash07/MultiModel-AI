const path = require('path');
const { pathToFileURL } = require('url');
const React = require(path.resolve(__dirname, '../client/node_modules/react'));
const ReactDOMServer = require(path.resolve(__dirname, '../client/node_modules/react-dom/server'));

async function testRender() {
  const ReactMarkdown = (await import(pathToFileURL(path.resolve(__dirname, '../client/node_modules/react-markdown/index.js')).href)).default;
  const remarkGfm = (await import(pathToFileURL(path.resolve(__dirname, '../client/node_modules/remark-gfm/index.js')).href)).default;

  const md = `# Markdown Test

Here is a paragraph with **bold** and *italic* and \`inline code\`.

### 1. Architectures
* **Transformers (Text & Code):** Powers LLMs.
* **Diffusion Models:** Midjourney, DALL-E 3.

| Domain | Application | Tools |
| :--- | :--- | :--- |
| Dev | Boilerplate | Copilot, Cursor |
| Search | RAG | LangChain, pgvector |

\`\`\`python
def hello_world():
    print("Testing code block in export")
\`\`\`

> Blockquote with important information.

---

Hindi text: भारत की राजधानी क्या है?
Marathi text: महाराष्ट्राची राजधानी कोणती आहे
Gujarati text: અમદાવાદ વિશે 2 વાક્યમાં સમજાવો
`;

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      components: {
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');
          if (!inline) {
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
        table({ children, ...props }) {
          return React.createElement(
            'div',
            { className: 'table-wrapper' },
            React.createElement('table', { className: 'markdown-table', ...props }, children)
          );
        }
      }
    }, md)
  );

  console.log('Successfully rendered HTML!');
  console.log('Length:', html.length);
  console.log('Contains table:', html.includes('<table class="markdown-table"'));
  console.log('Contains code container:', html.includes('<div class="code-container"'));
  console.log('Contains Hindi:', html.includes('भारत की राजधानी'));
  console.log('Contains Marathi:', html.includes('महाराष्ट्राची राजधानी'));
  console.log('Contains Gujarati:', html.includes('અમદાવાદ વિશે'));
}

testRender().catch(err => {
  console.error('Render error:', err);
  process.exit(1);
});
