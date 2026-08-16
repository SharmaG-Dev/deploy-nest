import { ChromaClient } from 'chromadb';
import { ENV } from './env.config';

export const chromaClient = new ChromaClient({
  path: ENV.CHROMA_PATH,
});
