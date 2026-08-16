import { ENV } from './env.config';

export const redisConfig = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
};
