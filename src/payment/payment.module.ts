import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { CheckoutController } from './checkout.controller';
import { OrdersModule } from '../orders/orders.module'; // importamos el módulo de órdenes
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/orders/order.entity';
import { PaymentTransaction } from './PaymentTransaction.entity';
import { ProductsModule } from 'src/products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, PaymentTransaction]),
    OrdersModule,
    ProductsModule
  ], providers: [PaymentService],
  controllers: [PaymentController, CheckoutController],
  exports: [PaymentService], // exportamos por si otro módulo necesita usarlo
})
export class PaymentModule { }
