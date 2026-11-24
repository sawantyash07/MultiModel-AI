import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient = null;
let pineconeStatus = {
  initialized: false,
  connected: false,
  indexName: process.env.PINECONE_INDEX || 'shop-support',
  indexes: [],
  dimension: 1024,
  error: null
};

export function getPineconeClient() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    pineconeStatus.error = 'PINECONE_API_KEY is not set';
    return null;
  }

  if (!pineconeClient) {
    try {
      pineconeClient = new Pinecone({ apiKey });
      pineconeStatus.initialized = true;
    } catch (err) {
      pineconeStatus.error = err.message;
      return null;
    }
  }
  return pineconeClient;
}

export async function checkPineconeHealth() {
  try {
    const pc = getPineconeClient();
    if (!pc) {
      return pineconeStatus;
    }

    const indexList = await pc.listIndexes();
    pineconeStatus.connected = true;
    pineconeStatus.indexes = indexList.indexes ? indexList.indexes.map(i => ({
      name: i.name,
      dimension: i.dimension,
      metric: i.metric,
      state: i.status?.state || 'Ready'
    })) : [];

    const targetIndex = pineconeStatus.indexes.find(i => i.name === pineconeStatus.indexName);
    if (targetIndex) {
      pineconeStatus.dimension = targetIndex.dimension;
    }

    pineconeStatus.error = null;
    return pineconeStatus;
  } catch (err) {
    pineconeStatus.connected = false;
    pineconeStatus.error = err.message;
    return pineconeStatus;
  }
}

export async function queryPineconeContext(queryVector, topK = 3) {
  try {
    const pc = getPineconeClient();
    if (!pc) return [];

    const index = pc.index(pineconeStatus.indexName);
    const queryResponse = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true
    });

    return (queryResponse.matches || []).map(m => ({
      id: m.id,
      score: m.score,
      metadata: m.metadata || {}
    }));
  } catch (err) {
    console.warn('[Pinecone] Query failed:', err.message);
    return [];
  }
}
