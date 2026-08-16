import { ENV } from './env.config';

export const appConfig = {
  port: ENV.PORT,
  encryptionSecret: ENV.ENCRYPTION_SECRET,
  jwtAccessSecret: ENV.JWT_ACCESS_SECRET,
  jwtRefreshSecret: ENV.JWT_REFRESH_SECRET,
};
