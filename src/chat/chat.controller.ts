import { Controller, Get, Post, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('deployments/:id/chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  getMessages(@Param('id') deploymentId: string, @CurrentUser('sub') userId: string) {
    return this.chatService.getMessages(deploymentId, userId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  sendMessage(
    @Param('id') deploymentId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.chatService.sendMessage(deploymentId, userId, dto, file);
  }
}
