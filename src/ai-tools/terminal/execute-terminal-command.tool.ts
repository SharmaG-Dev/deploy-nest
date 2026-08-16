import { Injectable, Logger } from '@nestjs/common';
import { AiTool } from '../ai-tool.interface';
import { AiToolContext, AiToolDefinition, AiToolResult } from '../ai-tool.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DockerService } from '../../docker/docker.service';
import { DeploymentStatus } from '@prisma/client';

@Injectable()
export class ExecuteTerminalCommandTool implements AiTool {
  name = 'execute_terminal_command';
  private readonly logger = new Logger(ExecuteTerminalCommandTool.name);

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
  ) {}

  getDefinition(): AiToolDefinition {
    return {
      name: this.name,
      description: 'Execute a finite shell command inside the project\'s Docker workspace. Use this to install dependencies, build the project, or inspect files.',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute (e.g., "npm install", "ls -la"). Do NOT use this for long running processes like "npm run dev".'
          }
        },
        required: ['command']
      }
    };
  }

  async execute(input: any, context: AiToolContext): Promise<AiToolResult> {
    const { command } = input;

    if (!command || typeof command !== 'string') {
      return { success: false, error: { code: 'INVALID_COMMAND', message: 'Command must be a non-empty string.' } };
    }

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: context.deploymentId },
    });

    if (!deployment) {
      return { success: false, error: { code: 'DEPLOYMENT_NOT_FOUND', message: 'Deployment not found.' } };
    }

    if (deployment.userId !== context.userId) {
      return { success: false, error: { code: 'PERMISSION_DENIED', message: 'You do not own this deployment.' } };
    }

    if (deployment.status !== DeploymentStatus.READY) {
      return { 
        success: false, 
        error: { 
          code: 'DEPLOYMENT_NOT_READY', 
          message: `Deployment status is ${deployment.status}. It must be READY to execute commands.` 
        } 
      };
    }

    if (!deployment.containerId) {
      return { success: false, error: { code: 'CONTAINER_NOT_FOUND', message: 'No container is attached to this deployment.' } };
    }

    try {
      this.logger.log(`Executing AI command for deployment ${deployment.id}: ${command}`);
      
      // We pass it to bash -c so that chained commands and env vars work correctly
      const result = await this.dockerService.execCommand(deployment.containerId, ['bash', '-c', command]);
      
      // Enforce output limits (e.g., 100KB max per stream)
      const maxOutputBytes = 100000;
      let stdout = result.stdout;
      let stderr = result.stderr;
      let truncated = false;

      if (stdout.length > maxOutputBytes) {
        stdout = stdout.substring(0, maxOutputBytes) + '\n... [STDOUT TRUNCATED] ...';
        truncated = true;
      }

      if (stderr.length > maxOutputBytes) {
        stderr = stderr.substring(0, maxOutputBytes) + '\n... [STDERR TRUNCATED] ...';
        truncated = true;
      }

      return {
        success: true,
        data: {
          stdout,
          stderr,
          exitCode: result.exitCode,
          truncated
        }
      };

    } catch (e) {
      this.logger.error(`Error executing terminal command: ${e.message}`);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: e.message
        }
      };
    }
  }
}
