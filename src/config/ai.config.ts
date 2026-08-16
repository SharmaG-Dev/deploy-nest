import { ChatOpenAI } from '@langchain/openai';
import { ENV } from './env.config';

export const chatModel = new ChatOpenAI({
  modelName: 'openai/gpt-4o-mini',
  apiKey: ENV.OPENROUTER_API_KEY,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
  },
});
