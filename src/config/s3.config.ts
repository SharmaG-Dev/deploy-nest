import { S3Client } from '@aws-sdk/client-s3';
import { ENV } from './env.config';

export const s3Client = new S3Client({
  region: ENV.S3_REGION,
  endpoint: ENV.S3_ENDPOINT,
  forcePathStyle: ENV.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: ENV.S3_ACCESS_KEY_ID,
    secretAccessKey: ENV.S3_SECRET_ACCESS_KEY,
  },
});

export const S3_BUCKET = ENV.S3_BUCKET;
export const S3_ENDPOINT = ENV.S3_ENDPOINT;
