import { Module } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { IngestionModule } from '../ingestion/ingestion.module';
import { BullModule } from '@nestjs/bullmq';
import { DeploymentProcessor } from './deployment.processor';
import { DockerModule } from '../docker/docker.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { S3Service } from '../common/services/s3.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    IngestionModule,
    DockerModule,
    BullModule.registerQueue({
      name: 'deployment',
    }),
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor, S3Service],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
