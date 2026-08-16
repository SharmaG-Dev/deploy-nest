import { Module, OnModuleInit } from '@nestjs/common';
import { AiToolRegistry } from './ai-tool.registry';
import { PrismaModule } from '../prisma/prisma.module';
import { DockerModule } from '../docker/docker.module';
import { GetDeploymentStatusTool } from './deployment/get-deployment-status.tool';
import { GetDeploymentLogsTool } from './deployment/get-deployment-logs.tool';
import { ExecuteTerminalCommandTool } from './terminal/execute-terminal-command.tool';

@Module({
  imports: [PrismaModule, DockerModule],
  providers: [
    AiToolRegistry,
    GetDeploymentStatusTool,
    GetDeploymentLogsTool,
    ExecuteTerminalCommandTool,
  ],
  exports: [AiToolRegistry],
})
export class AiToolsModule implements OnModuleInit {
  constructor(
    private readonly registry: AiToolRegistry,
    private readonly getDeploymentStatusTool: GetDeploymentStatusTool,
    private readonly getDeploymentLogsTool: GetDeploymentLogsTool,
    private readonly executeTerminalCommandTool: ExecuteTerminalCommandTool,
  ) {}

  onModuleInit() {
    this.registry.register(this.getDeploymentStatusTool);
    this.registry.register(this.getDeploymentLogsTool);
    this.registry.register(this.executeTerminalCommandTool);
  }
}
