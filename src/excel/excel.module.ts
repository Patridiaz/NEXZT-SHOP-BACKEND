import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelService } from './excel.service';
import { Brand } from 'src/brands/brand.entity';
import { Game } from 'src/games/game.entity';
import { Edition } from 'src/editions/edition.entity';
import { Subdivision } from 'src/subdivisions/subdivision.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Brand, Game, Edition, Subdivision]),
  ],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}