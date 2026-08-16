import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptoService],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plainText = 'my-secret-text';
      const encrypted = service.encrypt(plainText);

      expect(encrypted).not.toBe(plainText);
      expect(encrypted).toContain(':');

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it('should throw an error for invalid encrypted format', () => {
      expect(() => service.decrypt('invalid_format')).toThrow(
        'Invalid encrypted format',
      );
    });

    it('should fail to decrypt with tampered ciphertext', () => {
      const encrypted = service.encrypt('test');
      const [iv] = encrypted.split(':');
      // Produce a tampered ciphertext of the same length
      const tampered = `${iv}:00000000000000000000000000000000`;

      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('hashPassword and comparePassword', () => {
    it('should hash password and compare successfully', () => {
      const password = 'my-strong-password';
      const hashed = service.hashPassword(password);

      expect(hashed).not.toBe(password);

      const isMatch = service.comparePassword(password, hashed);
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', () => {
      const hashed = service.hashPassword('password123');
      const isMatch = service.comparePassword('password456', hashed);
      expect(isMatch).toBe(false);
    });

    it('should return false for invalid hash format', () => {
      const isMatch = service.comparePassword('password123', 'invalid-hash');
      expect(isMatch).toBe(false);
    });
  });
});
