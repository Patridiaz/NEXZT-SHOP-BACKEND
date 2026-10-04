import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kardex } from './kardex.entity';
import { Product } from 'src/products/product.entity';
import { KardexService } from './kardex.service';
import { KardexController } from './kardex.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Kardex, Product])],
  controllers: [KardexController],
  providers: [KardexService],
  exports: [KardexService],
})
export class KardexModule {}
