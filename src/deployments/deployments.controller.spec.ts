import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { DeploymentStatus } from '@prisma/client';

describe('DeploymentsController', () => {
  let controller: DeploymentsController;
  let service: DeploymentsService;

  const mockDeploymentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByProject: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentsController],
      providers: [
        { provide: DeploymentsService, useValue: mockDeploymentsService },
        { provide: JwtService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DeploymentsController>(DeploymentsController);
    service = module.get<DeploymentsService>(DeploymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call create', async () => {
    const dto = { projectId: 'p1', commitHash: 'abc' };
    mockDeploymentsService.create.mockResolvedValue({ id: 'd1' });
    const result = await controller.create('u1', dto);
    expect(service.create).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ id: 'd1' });
  });

  it('should call findAll', async () => {
    mockDeploymentsService.findAll.mockResolvedValue([{ id: 'd1' }]);
    const result = await controller.findAll('u1');
    expect(service.findAll).toHaveBeenCalledWith('u1');
    expect(result).toEqual([{ id: 'd1' }]);
  });

  it('should call findByProject', async () => {
    mockDeploymentsService.findByProject.mockResolvedValue([{ id: 'd1' }]);
    const result = await controller.findByProject('u1', 'p1');
    expect(service.findByProject).toHaveBeenCalledWith('u1', 'p1');
    expect(result).toEqual([{ id: 'd1' }]);
  });

  it('should call findOne', async () => {
    mockDeploymentsService.findOne.mockResolvedValue({ id: 'd1' });
    const result = await controller.findOne('u1', 'd1');
    expect(service.findOne).toHaveBeenCalledWith('d1', 'u1');
    expect(result).toEqual({ id: 'd1' });
  });

  it('should call updateStatus', async () => {
    const dto = { status: DeploymentStatus.READY };
    mockDeploymentsService.updateStatus.mockResolvedValue({ id: 'd1' });
    const result = await controller.updateStatus('u1', 'd1', dto);
    expect(service.updateStatus).toHaveBeenCalledWith('d1', 'u1', dto);
    expect(result).toEqual({ id: 'd1' });
  });

  it('should call remove', async () => {
    mockDeploymentsService.remove.mockResolvedValue({ id: 'd1' });
    const result = await controller.remove('u1', 'd1');
    expect(service.remove).toHaveBeenCalledWith('d1', 'u1');
    expect(result).toEqual({ id: 'd1' });
  });
});
