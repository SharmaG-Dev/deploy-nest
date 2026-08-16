import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { chatModel } from '../config';
import { MessageSender } from '@prisma/client';
import { ChatMessage } from '../types';
import { AiToolRegistry } from '../ai-tools/ai-tool.registry';
import { AiToolContext } from '../ai-tools/ai-tool.types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly registry: AiToolRegistry) {}

  async getChatResponse(messages: ChatMessage[], systemPrompt?: string, context?: AiToolContext): Promise<string | null> {
    const langChainMessages: BaseMessage[] = messages.map((msg) => {
      if (msg.sender === MessageSender.SYSTEM) return new SystemMessage(msg.content);
      if (msg.sender === MessageSender.AI) return new AIMessage(msg.content);
      return new HumanMessage(msg.content);
    });

    if (systemPrompt) {
      langChainMessages.unshift(new SystemMessage(systemPrompt));
    }

    const toolDefinitions = this.registry.getDefinitions();
    let modelWithTools = chatModel;
    
    if (toolDefinitions.length > 0 && context) {
      const formattedTools = toolDefinitions.map(def => ({
        type: 'function' as const,
        function: {
          name: def.name,
          description: def.description,
          parameters: def.inputSchema,
        }
      }));
      modelWithTools = chatModel.bindTools(formattedTools) as any;
    }

    try {
      let response = await modelWithTools.invoke(langChainMessages);
      
      let toolCallCount = 0;
      const MAX_TOOL_CALLS = 10;

      while (response.tool_calls && response.tool_calls.length > 0 && toolCallCount < MAX_TOOL_CALLS) {
        toolCallCount++;
        langChainMessages.push(response);

        for (const toolCall of response.tool_calls) {
          const toolResult = await this.registry.execute(toolCall.name, toolCall.args, context!);
          
          const contentStr = toolResult.success 
            ? JSON.stringify(toolResult.data) 
            : JSON.stringify({ error: toolResult.error });

          langChainMessages.push(new ToolMessage({
            tool_call_id: toolCall.id!,
            content: contentStr,
          }));
        }

        response = await modelWithTools.invoke(langChainMessages);
      }

      return response.content.toString();
    } catch (error) {
      this.logger.error('AI Error:', error);
      return null; 
    }
  }
}
