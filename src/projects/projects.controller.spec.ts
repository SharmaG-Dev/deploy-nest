import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let service: ProjectsService;

  const mockProjectsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: JwtService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectsController>(ProjectsController);
    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call create', async () => {
    const dto = { name: 'Test', repositoryUrl: 'url', branch: 'main' };
    mockProjectsService.create.mockResolvedValue({ id: '1' });
    const result = await controller.create('u1', dto);
    expect(service.create).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ id: '1' });
  });

  it('should call findAll', async () => {
    mockProjectsService.findAll.mockResolvedValue([{ id: '1' }]);
    const result = await controller.findAll('u1');
    expect(service.findAll).toHaveBeenCalledWith('u1');
    expect(result).toEqual([{ id: '1' }]);
  });

  it('should call findOne', async () => {
    mockProjectsService.findOne.mockResolvedValue({ id: '1' });
    const result = await controller.findOne('u1', '1');
    expect(service.findOne).toHaveBeenCalledWith('1', 'u1');
    expect(result).toEqual({ id: '1' });
  });

  it('should call update', async () => {
    mockProjectsService.update.mockResolvedValue({ id: '1' });
    const result = await controller.update('u1', '1', { name: 'Updated' });
    expect(service.update).toHaveBeenCalledWith('1', 'u1', { name: 'Updated' });
    expect(result).toEqual({ id: '1' });
  });

  it('should call remove', async () => {
    mockProjectsService.remove.mockResolvedValue({ id: '1' });
    const result = await controller.remove('u1', '1');
    expect(service.remove).toHaveBeenCalledWith('1', 'u1');
    expect(result).toEqual({ id: '1' });
  });
});
