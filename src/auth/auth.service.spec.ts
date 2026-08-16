import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CryptoService } from '../common/services/crypto.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let cryptoService: CryptoService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    updateRefreshToken: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockCryptoService = {
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('should throw ConflictException if user exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
      });
      await expect(
        service.signup({
          email: 'test@test.com',
          password: 'pass',
          name: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully signup and return tokens', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockCryptoService.hashPassword.mockReturnValue('hashed');
      mockUsersService.create.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        name: 'Test',
      });
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockCryptoService.encrypt.mockReturnValue('encrypted-refresh');
      mockUsersService.updateRefreshToken.mockResolvedValue(true);

      const result = await service.signup({
        email: 'test@test.com',
        password: 'pass',
        name: 'Test',
      });

      expect(result).toEqual({
        user: { id: '1', email: 'test@test.com', name: 'Test' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
        '1',
        'encrypted-refresh',
      );
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'test@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        password: 'hashed',
      });
      mockCryptoService.comparePassword.mockReturnValue(false);
      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully login and return tokens', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        password: 'hashed',
        name: 'Test',
      });
      mockCryptoService.comparePassword.mockReturnValue(true);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockCryptoService.encrypt.mockReturnValue('encrypted-refresh');

      const result = await service.login({
        email: 'test@test.com',
        password: 'pass',
      });
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException on invalid token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
      await expect(service.refresh('invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should successfully refresh tokens', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: '1' });
      mockUsersService.findById.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        encryptedRefreshToken: 'encrypted-token',
      });
      mockCryptoService.decrypt.mockReturnValue('valid-refresh');
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      mockCryptoService.encrypt.mockReturnValue('new-encrypted');

      const result = await service.refresh('valid-refresh');
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
    });
  });
});
