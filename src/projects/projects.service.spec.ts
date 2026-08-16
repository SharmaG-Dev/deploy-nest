import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
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
        ProjectsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a project', async () => {
    const dto = { name: 'Test', repositoryUrl: 'url', branch: 'main' };
    mockPrismaService.project.create.mockResolvedValue({
      id: '1',
      ...dto,
      userId: 'u1',
    });
    const result = await service.create('u1', dto);
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { ...dto, userId: 'u1' },
    });
    expect(result.id).toEqual('1');
  });

  it('should findAll projects', async () => {
    mockPrismaService.project.findMany.mockResolvedValue([{ id: '1' }]);
    const result = await service.findAll('u1');
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.any(Object));
    expect(result).toHaveLength(1);
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);
      await expect(service.findOne('1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return project if found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: '1' });
      const result = await service.findOne('1', 'u1');
      expect(result.id).toEqual('1');
    });
  });

  it('should update a project', async () => {
    mockPrismaService.project.findFirst.mockResolvedValue({ id: '1' });
    mockPrismaService.project.update.mockResolvedValue({
      id: '1',
      name: 'Updated',
    });
    const result = await service.update('1', 'u1', { name: 'Updated' });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'Updated' },
    });
    expect(result.name).toEqual('Updated');
  });

  it('should remove a project', async () => {
    mockPrismaService.project.findFirst.mockResolvedValue({ id: '1' });
    mockPrismaService.project.delete.mockResolvedValue({ id: '1' });
    const result = await service.remove('1', 'u1');
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(result.id).toEqual('1');
  });
});
