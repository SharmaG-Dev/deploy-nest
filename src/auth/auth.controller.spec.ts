import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from './guards/auth.guard';
import { JwtService } from '@nestjs/jwt';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let usersService: UsersService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call signup', async () => {
    const dto = { email: 'test@test.com', password: 'pass', name: 'Test' };
    mockAuthService.signup.mockResolvedValue({ accessToken: 'token' });
    const result = await controller.signup(dto);
    expect(authService.signup).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ accessToken: 'token' });
  });

  it('should call login', async () => {
    const dto = { email: 'test@test.com', password: 'pass' };
    mockAuthService.login.mockResolvedValue({ accessToken: 'token' });
    const result = await controller.login(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ accessToken: 'token' });
  });

  it('should call getProfile', async () => {
    mockUsersService.findById.mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      password: 'hash',
      encryptedRefreshToken: 'enc',
    });
    const result = await controller.getProfile('1');
    expect(usersService.findById).toHaveBeenCalledWith('1');
    expect(result).toEqual({ id: '1', email: 'test@test.com' });
  });
});
