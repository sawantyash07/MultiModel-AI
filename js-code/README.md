# JavaScript RAG customer support

This is the JavaScript implementation of the AI customer support demo. It uses ordinary
function calls—there is no HTTP controller or API route.

The existing PDFs are read from `../spring-code/src/main/resources/knowledge`.
The Pinecone index must already exist with 1024 dimensions.

## Run

```bash
npm install
export OPENAI_API_KEY="your-openai-key"
export GEMINI_API_KEY="your-gemini-key"
export PINECONE_API_KEY="your-pinecone-key"
npm start -- "What is the return policy?"
```

You can also import and call `loadKnowledgeBase()` and `answerUserQuery()` from
`index.js`.
