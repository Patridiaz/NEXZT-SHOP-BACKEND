// En src/admin/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user.entity';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard) 
@Roles(UserRole.ADMIN)             
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('sales-over-time')
  getSalesOverTime() {
    return this.dashboardService.getSalesOverTime();
  }

  @Get('top-products')
  getTopProducts() {
    return this.dashboardService.getTopSellingProducts();
  }
}
