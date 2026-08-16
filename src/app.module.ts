import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { DockerModule } from './docker/docker.module';
import { GatewayModule } from './gateway/gateway.module';

import { BullModule } from '@nestjs/bullmq';
import { redisConfig } from './config';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
    }),
    GatewayModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    DeploymentsModule,
    ChatModule,
    AiModule,
    IngestionModule,
    DockerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
