import { Injectable } from '@nestjs/common';
import { AiTool } from '../ai-tool.interface';
import { AiToolContext, AiToolDefinition, AiToolResult } from '../ai-tool.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DockerService } from '../../docker/docker.service';

@Injectable()
export class GetDeploymentStatusTool implements AiTool {
  name = 'get_deployment_status';

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
  ) {}

  getDefinition(): AiToolDefinition {
    return {
      name: this.name,
      description: 'Get the current status of a deployment, including whether its Docker container is running.',
      inputSchema: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'The UUID of the deployment to check.'
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
          message: 'You can only check the status of the current conversation\'s deployment.'
        }
      };
    }

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId }
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

    let containerRunning = false;
    let containerInfo: any = null;

    if (deployment.containerId) {
      try {
        const inspect = await this.dockerService.inspectContainer(deployment.containerId);
        if (inspect) {
          containerRunning = inspect.State.Running;
          containerInfo = {
            state: inspect.State.Status,
            exitCode: inspect.State.ExitCode,
            error: inspect.State.Error,
          };
        }
      } catch (e) {
        // Container might have been removed
      }
    }

    return {
      success: true,
      data: {
        status: deployment.status,
        errorMessage: deployment.errorMessage,
        containerId: deployment.containerId,
        containerRunning,
        containerInfo,
        createdAt: deployment.createdAt,
      }
    };
  }
}
