import { Controller, Get, Render } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  getPreview() {
    return { title: 'NestJS Cloud Deployment Platform' };
  }

  @Get('auth')
  @Render('auth')
  getAuth() {
    return { title: 'Authentication' };
  }

  @Get('dashboard')
  @Render('dashboard')
  getDashboard() {
    return { title: 'Dashboard' };
  }

  @Get('deployments/:id/view')
  @Render('deployment')
  getDeployment() {
    return { title: 'Deployment Details' };
  }
}
