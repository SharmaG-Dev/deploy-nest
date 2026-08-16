import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import { S3Service } from '../common/services/s3.service';
import { DeploymentStatus } from '@prisma/client';
import * as path from 'path';
import { DeploymentsGateway } from './deployments.gateway';

@Processor('deployment')
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger(DeploymentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dockerService: DockerService,
    private readonly s3Service: S3Service,
    private readonly gateway: DeploymentsGateway,
  ) {
    super();
  }

  async process(job: Job<{ deploymentId: string; projectId: string }, any, string>): Promise<any> {
    const { deploymentId, projectId } = job.data;
    this.logger.log(`Starting container deployment job for: ${deploymentId}`);
    await this.gateway.emitLog(deploymentId, `[System] Starting container deployment...`);

    try {
      const deployment = await this.prisma.deployment.findUnique({ 
        where: { id: deploymentId },
        include: { project: true }
      });
      if (!deployment) throw new Error('Deployment not found');

      if (deployment.containerId) {
        const existingContainer = await this.dockerService.inspectContainer(deployment.containerId);
        if (existingContainer) {
          this.logger.log(`Container ${deployment.containerId} already exists, skipping creation.`);
          await this.gateway.emitLog(deploymentId, `[Docker] Container already exists: ${deployment.containerId}. Skipping creation.`);
          return { status: 'reused' };
        }
      }

      await this.updateStatus(deploymentId, DeploymentStatus.CREATING);
      await this.gateway.emitLog(deploymentId, `[Docker] Creating new isolated environment...`);
      
      const containerName = `deploy_${deploymentId.replace(/-/g, '')}`;
      
      const container = await this.dockerService.createWorkspaceContainer(
        containerName,
        deploymentId,
        projectId,
        deployment.userId,
      );
      await this.gateway.emitLog(deploymentId, `[Docker] Container created with ID: ${container.id.substring(0, 12)}`);

      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { containerId: container.id, containerName },
      });
      
      await this.updateStatus(deploymentId, DeploymentStatus.DOWNLOADING);
      await this.gateway.emitLog(deploymentId, `[Docker] Starting container...`);
      await this.dockerService.startContainer(container.id);
      await this.gateway.emitLog(deploymentId, `[Docker] Container started successfully.`);

      if (deployment.project.projectUrl) {
        await this.updateStatus(deploymentId, DeploymentStatus.EXTRACTING);
        await this.gateway.emitLog(deploymentId, `[System] Hydrating workspace with project files...`);
        
        try {
          const presignedUrl = await this.s3Service.getPresignedDownloadUrl(deployment.project.projectUrl);
          
          await this.gateway.emitLog(deploymentId, `[Docker] Installing unzip and wget...`);
          const aptRes = await this.dockerService.execCommand(container.id, ['bash', '-c', 'apt-get update && apt-get install -y wget unzip']);
          if (aptRes.exitCode !== 0) await this.gateway.emitLog(deploymentId, `[Docker Error] apt-get failed: ${aptRes.stderr}`);
          
          await this.gateway.emitLog(deploymentId, `[Docker] Downloading project from secure S3 link...`);
          await this.dockerService.execCommand(container.id, ['bash', '-c', 'mkdir -p /workspace']);
          const wgetRes = await this.dockerService.execCommand(container.id, ['bash', '-c', `wget -qO /workspace/project.zip "${presignedUrl}"`]);
          if (wgetRes.exitCode !== 0) await this.gateway.emitLog(deploymentId, `[Docker Error] wget failed: ${wgetRes.stderr}`);
          
          await this.gateway.emitLog(deploymentId, `[Docker] Extracting project files...`);
          const unzipRes = await this.dockerService.execCommand(container.id, ['bash', '-c', 'unzip -q /workspace/project.zip -d /workspace']);
          if (unzipRes.exitCode !== 0) await this.gateway.emitLog(deploymentId, `[Docker Error] unzip failed: ${unzipRes.stderr}`);
          
          await this.gateway.emitLog(deploymentId, `[Docker] Cleaning up ZIP archive...`);
          await this.dockerService.execCommand(container.id, ['bash', '-c', 'rm -f /workspace/project.zip']);
          
          await this.gateway.emitLog(deploymentId, `[System] Workspace hydration complete.`);
        } catch (e) {
          this.logger.error(`Failed to hydrate container workspace: ${e.message}`);
          await this.gateway.emitLog(deploymentId, `[System] Warning: Failed to hydrate workspace: ${e.message}`);
        }
      }
      
      await this.updateStatus(deploymentId, DeploymentStatus.READY, { startedAt: new Date() });
      this.logger.log(`Deployment ${deploymentId} is READY.`);
      await this.gateway.emitLog(deploymentId, `[System] Deployment is READY and accepting terminal connections.`);
      
    } catch (error) {
      this.logger.error(`Deployment failed: ${error.message}`);
      await this.gateway.emitLog(deploymentId, `[Error] Deployment failed: ${error.message}`);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: DeploymentStatus.FAILED, errorMessage: error.message },
      });
      throw error;
    }
  }

  private async updateStatus(deploymentId: string, status: DeploymentStatus, extraData: any = {}) {
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status, ...extraData },
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
