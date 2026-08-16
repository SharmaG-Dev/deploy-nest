import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { chromaClient } from '../config';
import { DocumentChunk } from '../types';

@Injectable()
export class VectorDbService {
  private readonly logger = new Logger(VectorDbService.name);

  async storeDocuments(deploymentId: string, documents: DocumentChunk[]) {
    try {
      this.logger.log(`Storing ${documents.length} chunks into Chroma for deployment ${deploymentId}`);
      
      const collection = await chromaClient.getOrCreateCollection({
        name: `deploy_${deploymentId.replace(/-/g, '')}`,
      });

      const contents = documents.map(d => d.content);
      const metadatas = documents.map(d => d.metadata);
      const ids = documents.map((_, i) => `doc_${i}`);

      const BATCH_SIZE = 5;
      for (let i = 0; i < contents.length; i += BATCH_SIZE) {
        const batchContents = contents.slice(i, i + BATCH_SIZE);
        const batchMetadatas = metadatas.slice(i, i + BATCH_SIZE);
        const batchIds = ids.slice(i, i + BATCH_SIZE);

        await collection.add({
          ids: batchIds,
          metadatas: batchMetadatas,
          documents: batchContents,
        });
      }

      this.logger.log(`Successfully stored embeddings for deployment ${deploymentId}`);
    } catch (error) {
      this.logger.error(`Error storing documents in vector db: ${error.message}`);
      throw error;
    }
  }

  async similaritySearch(deploymentId: string, query: string, k: number = 4): Promise<DocumentChunk[]> {
    try {
      const collection = await chromaClient.getCollection({
        name: `deploy_${deploymentId.replace(/-/g, '')}`,
      });

      const results = await collection.query({
        queryTexts: [query],
        nResults: k,
      });

      const matchedDocs: DocumentChunk[] = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          matchedDocs.push({
            content: results.documents[0][i] as string,
            metadata: (results.metadatas ? results.metadatas[0][i] : {}) as Record<string, any>,
          });
        }
      }

      return matchedDocs;
    } catch (error) {
      this.logger.warn(`Error querying vector db: ${error.message}`);
      return [];
    }
  }

  async chunkCode(code: string, fileName: string): Promise<DocumentChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(code);
    return chunks.map(c => ({
      content: c,
      metadata: { fileName },
    }));
  }
}
