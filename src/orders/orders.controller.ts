import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Order } from './order.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // Crear pedido a partir del carrito
  @Post() // ✅ CAMBIADO: de @Post('checkout') a @Post()
  async createOrder(@Req() req): Promise<Order> { // Renombramos el método para más claridad
    const order = await this.ordersService.createOrder(req.user);
    return order;
  }

  // Ver pedidos del usuario logueado
  @Get()
  async getOrders(@Req() req) {
    return this.ordersService.findOrdersByUser(req.user);
  }
}