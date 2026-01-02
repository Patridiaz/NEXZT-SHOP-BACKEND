 import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { Region } from './region.entity';
import { Commune } from './commune.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Region, Commune])],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService], // Exportamos por si OrdersService necesita validar la comuna
})
export class LocationsModule {}