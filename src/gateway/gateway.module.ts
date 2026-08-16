import { Global, Module } from '@nestjs/common';
import { DeploymentsGateway } from '../deployments/deployments.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { DockerModule } from '../docker/docker.module';

@Global()
@Module({
  imports: [PrismaModule, DockerModule],
  providers: [DeploymentsGateway],
  exports: [DeploymentsGateway],
})
export class GatewayModule {}
