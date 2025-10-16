import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartItem } from './cart.entity';
import { Product } from '../products/product.entity';
import { UsersModule } from '../users/users.module';
import { GuestCartItem } from './guest-cart-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartItem, Product,GuestCartItem]),
    UsersModule, // para poder obtener info del usuario
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // importante para que OrdersModule lo use
})
export class CartModule {}
