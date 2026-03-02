import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Brand } from 'src/brands/brand.entity';
import { BrandsModule } from 'src/brands/brands.module';
import { Edition } from 'src/editions/edition.entity';
import { Game } from 'src/games/game.entity';
import { EditionsModule } from 'src/editions/editions.module';
import { Rarity } from 'src/rarities/rarity.entity';
import { RaritiesModule } from 'src/rarities/rarities.module';
import { ProductController } from './products.controller';
import { ProductService } from './products.service';
import { ExcelModule } from 'src/excel/excel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Brand, Edition, Game, Rarity]),
    BrandsModule,
    EditionsModule,
    RaritiesModule,
    ExcelModule
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService] // ✅ AÑADE ESTA LÍNEA
})
export class ProductsModule { }
