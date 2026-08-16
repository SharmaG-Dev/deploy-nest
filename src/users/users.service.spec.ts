import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const data = {
        email: 'test@test.com',
        password: 'hashedpassword',
        name: 'Test',
      };
      const createdUser = { id: 'user-id', ...data };
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.create(data);

      expect(prisma.user.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(createdUser);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'test@test.com';
      const user = { id: 'user-id', email };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findByEmail(email);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual(user);
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const id = 'user-id';
      const user = { id, email: 'test@test.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findById(id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(user);
    });
  });

  describe('updateRefreshToken', () => {
    it('should update refresh token', async () => {
      const id = 'user-id';
      const token = 'encrypted-token';
      const updatedUser = { id, encryptedRefreshToken: token };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateRefreshToken(id, token);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id },
        data: { encryptedRefreshToken: token },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});
