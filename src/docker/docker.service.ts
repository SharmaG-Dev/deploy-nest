import { Injectable, Logger } from '@nestjs/common';
import Docker from 'dockerode';
import * as path from 'path';

@Injectable()
export class DockerService {
  private docker: Docker;
  private readonly logger = new Logger(DockerService.name);
  private readonly DEFAULT_MEMORY_LIMIT = 512 * 1024 * 1024; // 512 MB
  private readonly DEFAULT_CPU_QUOTA = 50000; // 0.5 CPU
  private readonly DEFAULT_PIDS_LIMIT = 100;

  constructor() {
    this.docker = new Docker();
  }

  async ping() {
    return this.docker.ping();
  }

  async createWorkspaceContainer(
    containerName: string,
    deploymentId: string,
    projectId: string,
    userId: string,
  ): Promise<Docker.Container> {
    try {
      this.logger.log(`Creating container ${containerName} for deployment ${deploymentId}`);
      const imageName = 'ubuntu:24.04';
      try {
        await this.docker.getImage(imageName).inspect();
      } catch (e) {
        this.logger.log(`Image ${imageName} not found locally. Pulling from Docker Hub...`);
        await new Promise((resolve, reject) => {
          this.docker.pull(imageName, (err, stream) => {
            if (err) return reject(err);
            this.docker.modem.followProgress(stream, onFinished, onProgress);
            
            function onFinished(err, output) {
              if (err) return reject(err);
              resolve(output);
            }
            function onProgress(event) {
              // Optionally log progress here
            }
          });
        });
        this.logger.log(`Successfully pulled image ${imageName}`);
      }
      
      const container = await this.docker.createContainer({
        Image: 'ubuntu:24.04',
        name: containerName,
        Tty: true,
        Cmd: ['/bin/bash'],
        Labels: {
          'app': 'shippl',
          'deploymentId': deploymentId,
          'projectId': projectId,
          'userId': userId,
        },
        HostConfig: {
          Memory: this.DEFAULT_MEMORY_LIMIT,
          CpuQuota: this.DEFAULT_CPU_QUOTA,
          PidsLimit: this.DEFAULT_PIDS_LIMIT,
          NetworkMode: 'bridge', // Default isolated bridge
        },
      });

      return container;
    } catch (error) {
      this.logger.error(`Failed to create container ${containerName}: ${error.message}`);
      throw error;
    }
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      const info = await container.inspect();
      if (info.State.Running) {
        await container.stop();
      }
    } catch (error) {
      if (error.statusCode !== 404 && error.statusCode !== 304) {
        throw error;
      }
    }
  }

  async removeContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.remove({ force: true });
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }

  async inspectContainer(containerId: string): Promise<Docker.ContainerInspectInfo | null> {
    const container = this.docker.getContainer(containerId);
    try {
      return await container.inspect();
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async execCommand(containerId: string, cmd: string[]): Promise<{ stdout: string, stderr: string, exitCode: number }> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });
    
    return new Promise((resolve, reject) => {
      exec.start({ Detach: false }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return reject(new Error('Stream is undefined'));
        
        let stdout = '';
        let stderr = '';
        
        container.modem.demuxStream(stream, {
          write: (data: Buffer) => { stdout += data.toString(); }
        }, {
          write: (data: Buffer) => { stderr += data.toString(); }
        });
        
        stream.on('end', async () => {
          const inspect = await exec.inspect();
          resolve({ stdout, stderr, exitCode: inspect.ExitCode || 0 });
        });
      });
    });
  }

  async createTerminalSession(containerId: string, cols: number, rows: number) {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['/bin/bash'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: ['TERM=xterm'],
    });

    const stream = await new Promise<any>((resolve, reject) => {
      exec.start({ Detach: false, Tty: true, hijack: true, stdin: true }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return reject(new Error('Failed to start exec stream'));
        resolve(stream);
      });
    });

    await exec.resize({ w: cols, h: rows });

    return { exec, stream };
  }
}
