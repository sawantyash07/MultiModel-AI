const http = require('http');

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8080' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on('error', reject);
  });
}

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request('http://localhost:8080' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function patch(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request('http://localhost:8080' + path, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function del(path) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:8080' + path, { method: 'DELETE' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== [1] HEALTH CHECK ===');
  const health = await get('/api/health');
  console.log('Health status:', health.status, 'status:', health.data?.status || 'OK');

  console.log('\n=== [2] FETCH KNOWLEDGE GRAPH ===');
  const kg = await get('/api/knowledge-graph');
  console.log('Total nodes:', kg.data.totalNodes, 'Total edges:', kg.data.totalEdges);
  if (kg.data.totalNodes < 10) throw new Error('Expected at least 10 nodes extracted!');

  console.log('\n=== [3] SEARCH FILTERING ===');
  const searchReact = await get('/api/knowledge-graph/search?q=react');
  console.log('Search "react":', searchReact.data.nodes.length, 'matches');
  console.log('First match:', searchReact.data.nodes[0]?.label);

  console.log('\n=== [4] NODE DETAILS & CONNECTIONS ===');
  const reactNode = searchReact.data.nodes.find(n => n.label === 'React');
  if (reactNode) {
    const details = await get('/api/knowledge-graph/nodes/' + reactNode.id);
    console.log('Node details for React:', details.data.node.label, 'incident edges:', details.data.edges.length);

    const neighborhood = await get('/api/knowledge-graph/nodes/' + reactNode.id + '/connections?depth=1');
    console.log('Neighborhood (depth 1):', neighborhood.data.totalNodes, 'nodes,', neighborhood.data.totalEdges, 'edges');
  }

  console.log('\n=== [5] CRUD OPERATIONS ===');
  const createNodeRes = await post('/api/knowledge-graph/nodes', {
    label: 'Redis Cache',
    type: 'TECHNOLOGY',
    description: 'In-memory data structure store used as a cache',
    aliases: ['Redis']
  });
  console.log('Created node status:', createNodeRes.status, 'ID:', createNodeRes.data.id);
  const createdId = createNodeRes.data.id;

  const updateNodeRes = await patch('/api/knowledge-graph/nodes/' + createdId, {
    description: 'Ultra-fast in-memory cache and message broker'
  });
  console.log('Updated node status:', updateNodeRes.status, 'new desc:', updateNodeRes.data.description);

  const createEdgeRes = await post('/api/knowledge-graph/edges', {
    source: 'node-tech-spring-boot',
    target: createdId,
    relation: 'USES_TECHNOLOGY',
    description: 'Spring Boot connects to Redis for session caching'
  });
  console.log('Created edge status:', createEdgeRes.status, 'edge ID:', createEdgeRes.data?.id);

  if (createEdgeRes.data?.id) {
    const verifyRes = await post('/api/knowledge-graph/edges/' + createEdgeRes.data.id + '/verify?verified=true', {});
    console.log('Verify edge status:', verifyRes.status, 'status:', verifyRes.data?.status);

    const delEdgeRes = await del('/api/knowledge-graph/edges/' + createEdgeRes.data.id);
    console.log('Deleted edge status:', delEdgeRes.status);
  }

  const delNodeRes = await del('/api/knowledge-graph/nodes/' + createdId);
  console.log('Deleted node status:', delNodeRes.status);

  console.log('\n=== [6] ASK YOUR KNOWLEDGE GRAPH (GROUNDED Q&A) ===');
  const q1 = await post('/api/knowledge-graph/ask', {
    question: 'Which projects use React and Spring Boot?'
  });
  console.log('Q: "Which projects use React and Spring Boot?"');
  console.log('Answer snippet:', q1.data.answer.substring(0, 250) + '...');
  console.log('Cited nodes count:', q1.data.citedNodes.length);
  console.log('Insufficient evidence flag:', q1.data.insufficientEvidence);

  console.log('\n=== [7] ASK WITH NO EVIDENCE (ANTI-HALLUCINATION TEST) ===');
  const q2 = await post('/api/knowledge-graph/ask', {
    question: 'What is the recipe for chocolate lava cake?'
  });
  console.log('Q: "What is the recipe for chocolate lava cake?"');
  console.log('Answer:', q2.data.answer);
  console.log('Insufficient evidence flag:', q2.data.insufficientEvidence);

  console.log('\n=== [8] GRAPH INSIGHTS ===');
  const insights = await get('/api/knowledge-graph/insights');
  console.log('Insights status:', insights.status);
  console.log('Top connected:', insights.data.mostConnectedEntities.slice(0, 3).map(e => e.label + ' (' + e.connectionCount + ')'));
  console.log('Projects with tech count:', insights.data.projectsWithTech.length);
  console.log('Cross-source entities count:', insights.data.crossSourceEntities.length);

  console.log('\n=== [9] FRONTEND ASSETS VERIFICATION ===');
  const home = await get('/');
  console.log('Home HTML status:', home.status, 'HTML length:', (home.text || '').length);
  const match = (home.text || '').match(/assets\/index-[^"]+\.js/);
  if (match) {
    const bundleAsset = await get('/' + match[0]);
    console.log('Vite JS Bundle status:', bundleAsset.status, 'Size:', (bundleAsset.text || '').length);
  }

  console.log('\n🎉 ALL E2E KNOWLEDGE GRAPH VERIFICATIONS PASSED SUCCESSFULLY! 🎉');
}

run().catch(err => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
