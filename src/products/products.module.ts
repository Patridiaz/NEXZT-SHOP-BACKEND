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
import { Subdivision } from 'src/subdivisions/subdivision.entity';
import { ProductController } from './products.controller';
import { ProductService } from './products.service';
import { StockAlertsService } from './stock-alerts.service';
import { ExcelModule } from 'src/excel/excel.module';
import { KardexModule } from 'src/kardex/kardex.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Brand, Edition, Game, Rarity, Subdivision]),
    BrandsModule,
    EditionsModule,
    RaritiesModule,
    ExcelModule,
    KardexModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, StockAlertsService],
  exports: [ProductService, StockAlertsService],
})
export class ProductsModule {}
