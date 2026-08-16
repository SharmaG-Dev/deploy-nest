export interface AiToolContext {
  userId: string;
  projectId: string;
  deploymentId: string;
  conversationId?: string;
  agentId?: string;
}

export interface AiToolError {
  code: string;
  message: string;
}

export interface AiToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: AiToolError;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: any; // Typically a JSON Schema object for LLM function calling
}
