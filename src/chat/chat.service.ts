import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../common/services/s3.service';
import { AiService } from '../ai/ai.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageSender } from '@prisma/client';
import { VectorDbService } from '../ingestion/vector-db.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly aiService: AiService,
    private readonly vectorDb: VectorDbService,
  ) {}

  async getMessages(deploymentId: string, userId: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, userId },
    });
    if (!deployment) throw new NotFoundException('Deployment not found');

    return this.prisma.message.findMany({
      where: { deploymentId },
      include: { attachments: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(deploymentId: string, userId: string, dto: SendMessageDto, file?: Express.Multer.File) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, userId },
      include: { project: true },
    });
    if (!deployment) throw new NotFoundException('Deployment not found');

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;
    if (file) {
      fileUrl = await this.s3Service.uploadFile(file);
      fileName = file.originalname;
      fileType = file.mimetype;
    }

    // Save user message
    const userMessage = await this.prisma.message.create({
      data: {
        deploymentId,
        sender: MessageSender.USER,
        content: dto.content || (file ? `Attached a file: ${fileName}` : ''),
        attachments: fileUrl ? {
          create: {
            fileUrl,
            fileName: fileName!,
            fileType: fileType!,
          }
        } : undefined,
      },
      include: { attachments: true },
    });

    // Fetch previous messages for context
    const history = await this.prisma.message.findMany({
      where: { deploymentId },
      orderBy: { createdAt: 'asc' },
    });

    // 1. Check if we have project manifest
    const manifestContext = deployment.projectManifest 
      ? `\n\n### Project Context (Manifest) ###\n${deployment.projectManifest}` 
      : '';

    // 2. Query Vector DB for relevant code chunks if content exists
    let ragContext = '';
    if (dto.content) {
      const relevantDocs = await this.vectorDb.similaritySearch(deploymentId, dto.content, 4);
      if (relevantDocs.length > 0) {
        ragContext = `\n\n### Relevant Code Snippets ###\n` + relevantDocs.map(doc => `--- File: ${doc.metadata.fileName || 'Unknown'} ---\n${doc.content}`).join('\n\n');
      }
    }

    const systemPrompt = `You are an expert AI deployment assistant. You are helping to deploy the project "${deployment.project.name}". Respond nicely to the user and guide them through deployment or answer questions based on the codebase context provided. 
CRITICAL RULES:
- You are running inside an Ubuntu Docker container as the root user. Do NOT use "sudo" in any of your terminal commands (e.g., use "apt-get install redis-server" instead of "sudo apt-get install redis-server").
- If the user asks to install a package, execute the command directly using the execute_terminal_command tool.

${manifestContext}${ragContext}`;

    const aiResponseText = await this.aiService.getChatResponse(history, systemPrompt, {
      userId,
      projectId: deployment.projectId,
      deploymentId
    });
    
    if (aiResponseText) {
      const aiMessage = await this.prisma.message.create({
        data: {
          deploymentId,
          sender: MessageSender.AI,
          content: aiResponseText,
        },
        include: { attachments: true },
      });
      return { userMessage, aiMessage };
    } else {
      const aiMessage = await this.prisma.message.create({
        data: {
          deploymentId,
          sender: MessageSender.SYSTEM,
          content: "Sorry, I am currently unavailable. Please check the OpenRouter API Key.",
        },
        include: { attachments: true },
      });
      return { userMessage, aiMessage };
    }
  }
}
