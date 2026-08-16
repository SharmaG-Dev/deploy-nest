import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentStatusDto } from './dto/update-deployment-status.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';

@Controller('deployments')
@UseGuards(AuthGuard)
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateDeploymentDto) {
    return this.deploymentsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string) {
    return this.deploymentsService.findAll(userId);
  }

  @Get('project/:projectId')
  findByProject(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.deploymentsService.findByProject(userId, projectId);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.deploymentsService.findOne(id, userId);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDeploymentStatusDto,
  ) {
    return this.deploymentsService.updateStatus(id, userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.deploymentsService.remove(id, userId);
  }
}
