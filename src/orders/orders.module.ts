// orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { CartModule } from 'src/cart/cart.module';
import { PaymentTransaction } from 'src/payment/PaymentTransaction.entity';
import { Region } from 'src/locations/region.entity';
import { Commune } from 'src/locations/commune.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem,PaymentTransaction,Region, Commune]),
          CartModule, // <-- IMPORTANTE
          
],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService], // <-- IMPORTANTE: exportar el servicio
})
export class OrdersModule {}
