import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DeploymentStatus } from '@prisma/client';

export class UpdateDeploymentStatusDto {
  @IsEnum(DeploymentStatus)
  @IsNotEmpty()
  status: DeploymentStatus;

  @IsString()
  @IsOptional()
  logs?: string;
}
