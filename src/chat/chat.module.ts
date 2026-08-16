import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { S3Service } from '../common/services/s3.service';
import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule, IngestionModule],
  controllers: [ChatController],
  providers: [ChatService, S3Service],
})
export class ChatModule {}
