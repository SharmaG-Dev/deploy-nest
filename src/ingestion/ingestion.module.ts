import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestionProcessor } from './ingestion.processor';
import { ProjectParserService } from './project-parser.service';
import { VectorDbService } from './vector-db.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ingestion',
    }),
    PrismaModule,
    AiModule,
  ],
  providers: [IngestionProcessor, ProjectParserService, VectorDbService],
  exports: [BullModule, ProjectParserService, VectorDbService],
})
export class IngestionModule {}
