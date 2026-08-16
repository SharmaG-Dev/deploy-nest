import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { S3Service } from '../common/services/s3.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    userId: string,
    dto: CreateProjectDto,
    file?: Express.Multer.File,
  ) {
    let projectUrl: string | null = null;

    if (file) {
      projectUrl = await this.s3Service.uploadFile(file);
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        repositoryUrl: dto.repositoryUrl || 'local-upload',
        branch: dto.branch || 'main',
        userId,
        ...(projectUrl ? { projectUrl } : {}),
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: { deployments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(id: string, userId: string, dto: UpdateProjectDto) {
    await this.findOne(id, userId);

    return this.prisma.project.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.project.delete({
      where: { id },
    });
  }
}
