import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Public } from 'src/auth/public.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user.entity';

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('settings/maintenance')
  async getMaintenanceStatus() {
    const maintenance = await this.settingsService.getMaintenanceMode();
    return { maintenance };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/settings/maintenance')
  async updateMaintenanceStatus(@Body() body: { maintenance: boolean }) {
    const isMaintenance = await this.settingsService.setMaintenanceMode(
      Boolean(body.maintenance),
    );
    return {
      maintenance: isMaintenance,
      message: `Modo mantenimiento ${isMaintenance ? 'activado' : 'desactivado'} exitosamente.`,
    };
  }
}
