import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../config/env.config';

@Injectable()
export class ProjectParserService {
  private readonly logger = new Logger(ProjectParserService.name);
  private readonly s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: ENV.S3_REGION,
      endpoint: ENV.S3_ENDPOINT,
      forcePathStyle: ENV.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: ENV.S3_ACCESS_KEY_ID,
        secretAccessKey: ENV.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async downloadAndExtract(s3Url: string, deploymentId: string): Promise<string> {
    const urlParts = new URL(s3Url);
    // e.g. http://localhost:9000/lets-deploy/projects/uuid.zip
    const pathParts = urlParts.pathname.split('/').filter(p => p);
    // pathParts[0] = bucket, pathParts[1]... = key
    const bucket = pathParts[0];
    const key = pathParts.slice(1).join('/');

    const tmpDir = path.join(os.tmpdir(), `deploynest_${deploymentId}`);
    await fs.mkdir(tmpDir, { recursive: true });
    
    const zipPath = path.join(tmpDir, 'project.zip');

    try {
      this.logger.log(`Downloading ${key} from ${bucket} to ${zipPath}`);
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const byteArray = await response.Body?.transformToByteArray();
      if (!byteArray) throw new Error('Failed to download ZIP body');

      await fs.writeFile(zipPath, Buffer.from(byteArray));

      this.logger.log(`Extracting ${zipPath}`);
      const zip = new AdmZip(zipPath);
      const extractDir = path.join(tmpDir, 'extracted');
      await fs.mkdir(extractDir, { recursive: true });
      zip.extractAllTo(extractDir, true);
      
      return extractDir;
    } catch (error) {
      this.logger.error(`Failed to download and extract ZIP: ${error.message}`);
      throw error;
    }
  }

  async cleanup(extractDir: string) {
    try {
      const parentDir = path.dirname(extractDir);
      await fs.rm(parentDir, { recursive: true, force: true });
      this.logger.log(`Cleaned up temp directory ${parentDir}`);
    } catch (e) {
      this.logger.warn(`Failed to cleanup temp directory: ${e.message}`);
    }
  }

  isIgnored(filePath: string): boolean {
    const ignoredPatterns = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'venv',
      '__pycache__',
      '.env',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
    ];
    return ignoredPatterns.some(pattern => filePath.includes(pattern));
  }

  isBinary(fileName: string): boolean {
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.wav', '.exe', '.dll'];
    return binaryExts.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  async parseDirectory(dirPath: string): Promise<{ files: { path: string; content: string }[]; tree: string }> {
    const allFiles: { path: string; content: string }[] = [];
    const treeLines: string[] = [];

    const walk = async (currentPath: string, prefix: string = '') => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const entryPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(dirPath, entryPath).replace(/\\/g, '/');

        if (this.isIgnored(relativePath)) continue;

        const treePrefix = isLast ? '└── ' : '├── ';
        treeLines.push(`${prefix}${treePrefix}${entry.name}`);

        if (entry.isDirectory()) {
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');
          await walk(entryPath, nextPrefix);
        } else if (entry.isFile() && !this.isBinary(entry.name)) {
          try {
            const content = await fs.readFile(entryPath, 'utf8');
            allFiles.push({ path: relativePath, content });
          } catch (e) {
            // Might be a binary file read as text, skip
          }
        }
      }
    };

    treeLines.push('.');
    await walk(dirPath);

    return {
      files: allFiles,
      tree: treeLines.join('\n'),
    };
  }
}
