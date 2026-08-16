import { Injectable, Logger } from '@nestjs/common';
import { AiTool } from './ai-tool.interface';
import { AiToolContext, AiToolDefinition, AiToolResult } from './ai-tool.types';

@Injectable()
export class AiToolRegistry {
  private readonly logger = new Logger(AiToolRegistry.name);
  private tools: Map<string, AiTool> = new Map();

  register(tool: AiTool) {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered AI Tool: ${tool.name}`);
  }

  getTool(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): AiToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }

  async execute(name: string, input: any, context: AiToolContext): Promise<AiToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      this.logger.error(`Attempted to execute unregistered tool: ${name}`);
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool ${name} is not registered.`,
        }
      };
    }

    try {
      this.logger.log(`Executing tool ${name} for deployment ${context.deploymentId}`);
      const result = await tool.execute(input, context);
      return result;
    } catch (e) {
      this.logger.error(`Unhandled error in tool ${name}: ${e.message}`, e.stack);
      return {
        success: false,
        error: {
          code: 'INTERNAL_TOOL_ERROR',
          message: `An unexpected error occurred while executing ${name}.`,
        }
      };
    }
  }
}
