import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import * as stream from 'stream';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class DeploymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeploymentsGateway.name);
  private activeStreams: Map<string, stream.Duplex> = new Map();
  private activeExecs: Map<string, any> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly dockerService: DockerService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const activeStream = this.activeStreams.get(client.id);
    if (activeStream) {
      activeStream.end();
      this.activeStreams.delete(client.id);
      this.activeExecs.delete(client.id);
    }
  }

  @SubscribeMessage('joinDeployment')
  handleJoinDeployment(client: Socket, deploymentId: string) {
    client.join(deploymentId);
    this.logger.log(`Client ${client.id} joined room: ${deploymentId}`);
    return { event: 'joined', data: deploymentId };
  }

  @SubscribeMessage('leaveDeployment')
  handleLeaveDeployment(client: Socket, deploymentId: string) {
    client.leave(deploymentId);
    this.logger.log(`Client ${client.id} left room: ${deploymentId}`);
    return { event: 'left', data: deploymentId };
  }

  @SubscribeMessage('startTerminal')
  async handleStartTerminal(client: Socket, payload: { deploymentId: string, cols: number, rows: number }) {
    const { deploymentId, cols, rows } = payload;
    
    try {
      const deployment = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
      });

      if (!deployment || !deployment.containerId) {
        client.emit('terminalOutput', `\r\nError: Container not found for deployment ${deploymentId}\r\n`);
        return;
      }

      this.logger.log(`Starting interactive terminal for container ${deployment.containerId} (Client: ${client.id})`);
      
      const { exec, stream } = await this.dockerService.createTerminalSession(
        deployment.containerId,
        cols || 80,
        rows || 24,
      );

      this.activeStreams.set(client.id, stream as any);
      this.activeExecs.set(client.id, exec);

      stream.on('data', (chunk) => {
        client.emit('terminalOutput', chunk.toString('utf-8'));
      });

      stream.on('end', () => {
        client.emit('terminalOutput', '\r\nTerminal session ended.\r\n');
        this.activeStreams.delete(client.id);
        this.activeExecs.delete(client.id);
      });
      
    } catch (error) {
      this.logger.error(`Failed to start terminal: ${error.message}`);
      client.emit('terminalOutput', `\r\nFailed to start terminal: ${error.message}\r\n`);
    }
  }

  @SubscribeMessage('terminalInput')
  handleTerminalInput(client: Socket, input: string) {
    const stream = this.activeStreams.get(client.id);
    if (stream) {
      stream.write(input);
    }
  }

  @SubscribeMessage('terminalResize')
  async handleTerminalResize(client: Socket, payload: { cols: number, rows: number }) {
    const exec = this.activeExecs.get(client.id);
    if (exec) {
      try {
        await exec.resize({ w: payload.cols, h: payload.rows });
      } catch (err) {
        this.logger.error(`Error resizing terminal: ${err.message}`);
      }
    }
  }

  
  async emitLog(deploymentId: string, message: string) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    
    this.server.to(deploymentId).emit('deploymentLogs', logLine);

    try {
      const deployment = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { logs: true },
      });
      if (deployment) {
        await this.prisma.deployment.update({
          where: { id: deploymentId },
          data: { logs: (deployment.logs || '') + logLine },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to persist log for deployment ${deploymentId}: ${error.message}`);
    }
  }
}
