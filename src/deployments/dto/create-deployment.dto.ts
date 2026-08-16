import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDeploymentDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsOptional()
  commitHash?: string;
}
