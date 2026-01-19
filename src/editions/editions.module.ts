import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Edition } from './edition.entity';
import { Product } from 'src/products/product.entity';
import { Game } from 'src/games/game.entity';
import { EditionsService } from './editions.service';
import { EditionsController } from './editions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Edition, Product, Game])],
  providers: [EditionsService],
  controllers: [EditionsController],
  exports: [EditionsService],
})
export class EditionsModule { }
