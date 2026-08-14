import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  private isMaintenanceMode = false;

  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  async onModuleInit() {
    await this.initSettings();
  }

  private async initSettings() {
    try {
      let maintenanceSetting = await this.settingsRepository.findOne({
        where: { key: 'maintenance_mode' },
      });

      if (!maintenanceSetting) {
        const envInitial = process.env.MAINTENANCE_MODE === 'true';
        maintenanceSetting = this.settingsRepository.create({
          key: 'maintenance_mode',
          value: envInitial ? 'true' : 'false',
        });
        await this.settingsRepository.save(maintenanceSetting);
      }

      this.isMaintenanceMode = maintenanceSetting.value?.toString().trim().toLowerCase() === 'true';
    } catch (error) {
      console.error('Error in SettingsService.initSettings:', error);
      this.isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    }
  }

  async getMaintenanceMode(): Promise<boolean> {
    try {
      const setting = await this.settingsRepository.findOne({
        where: { key: 'maintenance_mode' },
      });
      if (setting) {
        const val = setting.value?.toString().trim().toLowerCase();
        this.isMaintenanceMode = val === 'true' || val === '1' || val === 'yes';
      }
    } catch (error) {
      console.error('Error fetching maintenance mode from DB:', error);
    }
    return this.isMaintenanceMode;
  }

  async setMaintenanceMode(enabled: boolean): Promise<boolean> {
    const valueStr = enabled ? 'true' : 'false';

    let setting = await this.settingsRepository.findOne({
      where: { key: 'maintenance_mode' },
    });

    if (!setting) {
      setting = this.settingsRepository.create({
        key: 'maintenance_mode',
        value: valueStr,
      });
    } else {
      setting.value = valueStr;
    }

    await this.settingsRepository.save(setting);
    this.isMaintenanceMode = enabled;
    return this.isMaintenanceMode;
  }
}
