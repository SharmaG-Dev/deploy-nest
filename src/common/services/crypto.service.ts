import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ENV } from '../../config/env.config';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;

  constructor() {
    const secret = ENV.ENCRYPTION_SECRET;
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  hashPassword(password: string): string {
    return this.encrypt(password);
  }

  comparePassword(plain: string, encrypted: string): boolean {
    try {
      const decrypted = this.decrypt(encrypted);
      return decrypted === plain;
    } catch {
      return false;
    }
  }
}
