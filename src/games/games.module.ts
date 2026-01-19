import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './game.entity';
import { Product } from 'src/products/product.entity';
import { Edition } from 'src/editions/edition.entity';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Product, Edition])],
  providers: [GamesService],
  controllers: [GamesController],
  exports: [GamesService],
})
export class GamesModule { }
