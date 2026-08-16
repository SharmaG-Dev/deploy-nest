import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectParserService } from './project-parser.service';
import { VectorDbService } from './vector-db.service';
import { AiService } from '../ai/ai.service';
import { IngestionStatus } from '@prisma/client';
import { IngestProjectPayload, DocumentChunk } from '../types';
import { DeploymentsGateway } from '../deployments/deployments.gateway';

@Processor('ingestion')
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private prisma: PrismaService,
    private parser: ProjectParserService,
    private vectorDb: VectorDbService,
    private aiService: AiService,
    private gateway: DeploymentsGateway,
  ) {
    super();
  }

  async process(job: Job<IngestProjectPayload, any, string>): Promise<any> {
    const { deploymentId, s3Url } = job.data;
    this.logger.log(`Starting ingestion for deployment: ${deploymentId}`);
    await this.gateway.emitLog(deploymentId, `[System] Starting ingestion process...`);

    let extractDir: string | null = null;
    try {
      await this.updateStatus(deploymentId, IngestionStatus.EXTRACTING);
      await this.gateway.emitLog(deploymentId, `[Ingestion] Downloading and extracting project files...`);
      extractDir = await this.parser.downloadAndExtract(s3Url, deploymentId);
      await this.updateStatus(deploymentId, IngestionStatus.INDEXING);
      await this.gateway.emitLog(deploymentId, `[Ingestion] Parsing directory structure...`);
      const { files, tree } = await this.parser.parseDirectory(extractDir);
      this.logger.log(`Parsed ${files.length} valid files for deployment ${deploymentId}`);
      await this.gateway.emitLog(deploymentId, `[Ingestion] Parsed ${files.length} files successfully.`);
      const criticalFiles = files.filter(f => ['package.json', 'Dockerfile', 'docker-compose.yml', 'requirements.txt'].includes(f.path.split('/').pop() || ''));
      let criticalFilesStr = criticalFiles.map(f => `--- ${f.path} ---\n${f.content.substring(0, 1000)}`).join('\n\n');
      const manifestPrompt = `Analyze this project structure and critical files. Write a concise summary of what this project does, its tech stack, and key features.
      
Project Tree:
${tree}

Critical Files:
${criticalFilesStr}`;

      let projectManifest = manifestPrompt;

      const allChunks: DocumentChunk[] = [];
      for (const file of files) {
        const chunks = await this.vectorDb.chunkCode(file.content, file.path);
        allChunks.push(...chunks);
      }
      
      if (allChunks.length > 0) {
        try {
          await this.gateway.emitLog(deploymentId, `[VectorDB] Generating and storing embeddings for ${allChunks.length} chunks...`);
          await this.vectorDb.storeDocuments(deploymentId, allChunks);
          await this.gateway.emitLog(deploymentId, `[VectorDB] Embeddings stored successfully.`);
        } catch (e) {
          this.logger.warn(`Failed to store vector embeddings: ${e.message}`);
          await this.gateway.emitLog(deploymentId, `[VectorDB] Warning: Failed to store some embeddings.`);
        }
      }

      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          ingestionStatus: IngestionStatus.READY,
          projectManifest: projectManifest,
        }
      });
      this.logger.log(`Ingestion completed for deployment ${deploymentId}`);
      await this.gateway.emitLog(deploymentId, `[Ingestion] Completed successfully.`);
    } catch (error) {
      this.logger.error(`Ingestion failed for deployment ${deploymentId}: ${error.message}`);
      await this.gateway.emitLog(deploymentId, `[Error] Ingestion failed: ${error.message}`);
      await this.updateStatus(deploymentId, IngestionStatus.FAILED);
      throw error;
    } finally {
      if (extractDir) {
        await this.parser.cleanup(extractDir);
      }
    }
  }

  private async updateStatus(deploymentId: string, status: IngestionStatus) {
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { ingestionStatus: status },
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
