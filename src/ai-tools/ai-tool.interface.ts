import { AiToolContext, AiToolDefinition, AiToolResult } from './ai-tool.types';

export interface AiTool {
  /**
   * The name of the tool, used to register and execute it.
   * e.g., 'execute_terminal_command'
   */
  name: string;

  /**
   * Returns the definition of the tool (schema, description, name)
   * to be passed to the LLM.
   */
  getDefinition(): AiToolDefinition;

  /**
   * Validates input, enforces security rules, and executes the tool's core logic.
   * @param input Raw input provided by the AI model
   * @param context Authenticated context for the tool
   * @returns Structured result containing either data or an error
   */
  execute(input: any, context: AiToolContext): Promise<AiToolResult>;
}
