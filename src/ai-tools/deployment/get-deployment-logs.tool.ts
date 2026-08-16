import { Injectable } from '@nestjs/common';
import { AiTool } from '../ai-tool.interface';
import { AiToolContext, AiToolDefinition, AiToolResult } from '../ai-tool.types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GetDeploymentLogsTool implements AiTool {
  name = 'get_deployment_logs';

  constructor(private prisma: PrismaService) {}

  getDefinition(): AiToolDefinition {
    return {
      name: this.name,
      description: 'Get the historical system logs of a deployment to understand build or startup failures.',
      inputSchema: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'The UUID of the deployment to fetch logs for.'
          }
        },
        required: ['deploymentId']
      }
    };
  }

  async execute(input: any, context: AiToolContext): Promise<AiToolResult> {
    const deploymentId = input.deploymentId;

    if (deploymentId !== context.deploymentId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED_DEPLOYMENT',
          message: 'You can only fetch logs of the current conversation\'s deployment.'
        }
      };
    }

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { userId: true, logs: true }
    });

    if (!deployment) {
      return {
        success: false,
        error: { code: 'DEPLOYMENT_NOT_FOUND', message: 'Deployment not found.' }
      };
    }

    if (deployment.userId !== context.userId) {
      return {
        success: false,
        error: { code: 'PERMISSION_DENIED', message: 'You do not own this deployment.' }
      };
    }

    // Limit log size if it's too large to prevent blowing up AI context
    const maxLogLength = 100000; // ~100KB characters
    let logs = deployment.logs || '';
    
    if (logs.length > maxLogLength) {
      logs = '... [LOGS TRUNCATED] ...\n' + logs.substring(logs.length - maxLogLength);
    }

    return {
      success: true,
      data: {
        logs
      }
    };
  }
}
