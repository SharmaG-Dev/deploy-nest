import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUrl()
  @IsOptional()
  repositoryUrl?: string;

  @IsString()
  @IsOptional()
  branch?: string;
}
