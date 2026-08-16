import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { s3Client, S3_BUCKET, S3_ENDPOINT } from '../../config';
import * as path from 'path';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName = S3_BUCKET;

  async uploadFile(
    file: Express.Multer.File,
    folder = 'projects',
  ): Promise<string> {
    const ext = path.extname(file.originalname);
    const key = `${folder}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await s3Client.send(command);
      this.logger.log(
        `File successfully uploaded to ${this.bucketName}/${key}`,
      );
      const endpoint = S3_ENDPOINT;
      return `${endpoint}/${this.bucketName}/${key}`;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to S3: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getPresignedDownloadUrl(s3Url: string): Promise<string> {
    try {
      const urlParts = new URL(s3Url);
      const pathParts = urlParts.pathname.split('/').filter(p => p);
      const bucket = pathParts[0];
      const key = pathParts.slice(1).join('/');

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      let url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      if (url.includes('localhost')) {
        url = url.replace('localhost', 'host.docker.internal');
      }

      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw error;
    }
  }
}
