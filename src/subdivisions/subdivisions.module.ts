import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subdivision } from './subdivision.entity';
import { SubdivisionsService } from './subdivisions.service';
import { SubdivisionsController } from './subdivisions.controller';
import { Game } from 'src/games/game.entity';
import { Product } from 'src/products/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subdivision, Game, Product])],
  controllers: [SubdivisionsController],
  providers: [SubdivisionsService],
  exports: [SubdivisionsService, TypeOrmModule],
})
export class SubdivisionsModule {}
