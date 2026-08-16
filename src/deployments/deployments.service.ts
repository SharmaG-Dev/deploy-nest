import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentStatusDto } from './dto/update-deployment-status.dto';
import { DeploymentStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('ingestion') private ingestionQueue: Queue,
    @InjectQueue('deployment') private deploymentQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateDeploymentDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found or unauthorized');
    }

    const existingDeployment = await this.prisma.deployment.findFirst({
      where: {
        projectId: dto.projectId,
        userId,
        status: {
          in: [
            DeploymentStatus.PENDING,
            DeploymentStatus.CREATING,
            DeploymentStatus.DOWNLOADING,
            DeploymentStatus.EXTRACTING,
            DeploymentStatus.STARTING,
            DeploymentStatus.READY,
          ],
        },
      },
    });

    if (existingDeployment) {
      return existingDeployment;
    }

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId: dto.projectId,
        userId,
        commitHash: dto.commitHash,
        status: DeploymentStatus.PENDING,
        logs: 'Initializing deployment build process...\n',
        messages: {
          create: {
            sender: 'SYSTEM',
            content: 'Hello, I am your AI deployer. How can I help you deploy this project today?',
          },
        },
      },
    });

    if (project.projectUrl) {
      await this.ingestionQueue.add('INGEST_PROJECT', {
        deploymentId: deployment.id,
        s3Url: project.projectUrl,
      });
      await this.deploymentQueue.add('CREATE_CONTAINER', {
        deploymentId: deployment.id,
        projectId: dto.projectId,
      });
    }

    return deployment;
  }

  async findAll(userId: string) {
    return this.prisma.deployment.findMany({
      where: { userId },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProject(userId: string, projectId: string) {
    return this.prisma.deployment.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, userId },
      include: {
        project: true,
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }

  async updateStatus(
    id: string,
    userId: string,
    dto: UpdateDeploymentStatusDto,
  ) {
    await this.findOne(id, userId);

    return this.prisma.deployment.update({
      where: { id },
      data: {
        status: dto.status,
        logs: dto.logs,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.deployment.delete({
      where: { id },
    });
  }
}
