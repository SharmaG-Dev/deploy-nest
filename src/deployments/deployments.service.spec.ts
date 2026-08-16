import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsService } from './deployments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
    },
    deployment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);
      await expect(
        service.create('u1', { projectId: 'p1', commitHash: 'abc' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a deployment', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrismaService.deployment.create.mockResolvedValue({
        id: 'd1',
        projectId: 'p1',
        userId: 'u1',
      });
      const result = await service.create('u1', {
        projectId: 'p1',
        commitHash: 'abc',
      });
      expect(prisma.deployment.create).toHaveBeenCalled();
      expect(result.id).toEqual('d1');
    });
  });

  it('should findAll deployments', async () => {
    mockPrismaService.deployment.findMany.mockResolvedValue([{ id: 'd1' }]);
    const result = await service.findAll('u1');
    expect(prisma.deployment.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('should findByProject', async () => {
    mockPrismaService.deployment.findMany.mockResolvedValue([{ id: 'd1' }]);
    const result = await service.findByProject('u1', 'p1');
    expect(prisma.deployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'p1', userId: 'u1' } }),
    );
    expect(result).toHaveLength(1);
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.deployment.findFirst.mockResolvedValue(null);
      await expect(service.findOne('d1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return deployment if found', async () => {
      mockPrismaService.deployment.findFirst.mockResolvedValue({ id: 'd1' });
      const result = await service.findOne('d1', 'u1');
      expect(result.id).toEqual('d1');
    });
  });

  it('should update status', async () => {
    mockPrismaService.deployment.findFirst.mockResolvedValue({ id: 'd1' });
    mockPrismaService.deployment.update.mockResolvedValue({
      id: 'd1',
      status: DeploymentStatus.READY,
    });
    const result = await service.updateStatus('d1', 'u1', {
      status: DeploymentStatus.READY,
    });
    expect(prisma.deployment.update).toHaveBeenCalled();
    expect(result.status).toEqual(DeploymentStatus.READY);
  });

  it('should remove a deployment', async () => {
    mockPrismaService.deployment.findFirst.mockResolvedValue({ id: 'd1' });
    mockPrismaService.deployment.delete.mockResolvedValue({ id: 'd1' });
    const result = await service.remove('d1', 'u1');
    expect(prisma.deployment.delete).toHaveBeenCalled();
    expect(result.id).toEqual('d1');
  });
});
