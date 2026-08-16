import { MessageSender } from '@prisma/client';

export interface ChatMessage {
  sender: MessageSender | string;
  content: string;
}
