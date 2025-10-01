import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelService } from './excel.service';
import { Brand } from 'src/brands/brand.entity';
import { Game } from 'src/games/game.entity';
import { Edition } from 'src/editions/edition.entity';

@Module({
  imports: [
    // Hacemos que los repositorios de Brand, Game y Edition estén disponibles
    TypeOrmModule.forFeature([Brand, Game, Edition]),
  ],
  providers: [ExcelService],
  exports: [ExcelService], // Exportamos el servicio para que otros módulos puedan usarlo
})
export class ExcelModule {}