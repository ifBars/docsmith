import { GoogleGenAI } from "@google/genai";
import { FileSummary, VectorChunk } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Model for Embeddings
const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Splits text into chunks of roughly ~500-1000 tokens to ensure good retrieval granularity.
 */
function chunkText(text: string, maxChunkSize = 1500): string[] {
  if (text.length <= maxChunkSize) return [text];
  
  const chunks: string[] = [];
  let currentChunk = "";
  
  // Split by paragraphs first
  const paragraphs = text.split('\n\n');
  
  for (const para of paragraphs) {
    if ((currentChunk.length + para.length) > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Generates embeddings for a batch of text chunks.
 */
export const embedChunks = async (
  files: FileSummary[], 
  type: 'MAIN' | 'REFERENCE',
  onProgress?: (count: number, total: number) => void
): Promise<VectorChunk[]> => {
  const vectorChunks: VectorChunk[] = [];
  
  // Flatten files into chunks
  let allTextChunks: { text: string; source: string }[] = [];
  
  files.forEach(f => {
    const rawChunks = chunkText(f.contentSnippet);
    rawChunks.forEach(c => {
      allTextChunks.push({ text: c, source: f.path });
    });
  });

  const total = allTextChunks.length;
  let processed = 0;

  // Process in batches to respect API limits (max 100 per request usually, keeping it safe at 20)
  const BATCH_SIZE = 20;
  
  for (let i = 0; i < allTextChunks.length; i += BATCH_SIZE) {
    const batch = allTextChunks.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch.map(b => b.text), // Correct API usage: pass array of strings
      });

      if (response.embeddings) {
        response.embeddings.forEach((emb, idx) => {
           // Depending on SDK version, values might be in `values` property
           const embeddingValues = emb.values; 
           if (embeddingValues) {
             vectorChunks.push({
               id: `${type}_${Date.now()}_${i + idx}`,
               text: batch[idx].text,
               sourceFile: batch[idx].source,
               embedding: embeddingValues,
               type: type
             });
           }
        });
      }
      
      processed += batch.length;
      if (onProgress) onProgress(processed, total);
      
    } catch (e) {
      console.error("Embedding batch failed", e);
    }
  }

  return vectorChunks;
};

/**
 * Calculates cosine similarity between two vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Retrieves the most relevant chunks for a query.
 */
export const retrieveContext = async (
  query: string,
  index: VectorChunk[],
  topK = 5
): Promise<VectorChunk[]> => {
  if (index.length === 0) return [];

  try {
    // Embed the query
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: query,
    });

    const queryEmbedding = response.embeddings?.[0]?.values;
    if (!queryEmbedding) return [];

    // Calculate similarity scores
    const scored = index.map(chunk => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Sort and slice
    scored.sort((a, b) => b.score - a.score);
    
    // Filter out low relevance noise if needed, currently taking top K
    return scored.slice(0, topK).map(s => s.chunk);

  } catch (e) {
    console.error("Retrieval failed", e);
    return [];
  }
};