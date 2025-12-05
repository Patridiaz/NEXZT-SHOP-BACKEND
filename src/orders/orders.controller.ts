import { Controller, Get, Post, UseGuards, Req, Body, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard'; // 👈 Importa el nuevo guard
import { CreateOrderDto } from './dto/create-order.dto';
import type { Request } from 'express';
import { Public } from 'src/auth/public.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user.entity';
import { DeliveryStatus } from './order.entity';

@Controller('orders')
// ❌ YA NO PONEMOS UN GUARDIA A NIVEL DE CLASE
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // ✅ RUTA PARA CREAR UNA ORDEN (INVITADO O LOGUEADO)
  // Como no tiene @UseGuards(JwtAuthGuard), el guardia global se activa.
  // Pero @Public le dice al guardia global que la ignore.
  // Luego, @UseGuards(OptionalJwtAuthGuard) intenta obtener el usuario si existe.
  @Public() // Le dice al guardia global que ignore esta ruta
  @Post()
  @UseGuards(OptionalJwtAuthGuard) // Usa el guard opcional para ver si hay un usuario logueado
  createOrder(@Body() createOrderDto: CreateOrderDto, @Req() req: Request) {
    const user = req.user as any;
    const userId = user ? user.id : undefined;
    return this.ordersService.createOrder(createOrderDto, userId);
  }

  // ✅ RUTA PARA OBTENER LAS ÓRDENES DEL USUARIO LOGUEADO
  @Get('mine') // 👈 Cambiamos la ruta a 'mine' para ser más claros
  @UseGuards(JwtAuthGuard) // 👈 Protegemos la ruta. Solo para usuarios con sesión.
  getMyOrders(@Req() req: Request) {
    const user = req.user;
    // Aquí 'user' NUNCA será undefined, porque JwtAuthGuard lo garantiza.
    return this.ordersService.findOrdersByUser(user as any);
  }

  // ✅ RUTA PARA VER UNA ORDEN ESPECÍFICA
  // La protegemos y en el servicio se debería verificar que el usuario sea el dueño
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOrderById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    // En el futuro, podrías crear un método en tu servicio que verifique la propiedad:
    // return this.ordersService.findOrderByIdForUser(id, user.id);
    return this.ordersService.findOrderById(id);

  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard) // Protege esta ruta específica
  @Roles(UserRole.ADMIN) // Solo rol admin
  findAll() {
    return this.ordersService.findAll();
  }

  @Patch(':id/delivery-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateDeliveryStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: DeliveryStatus // Recibe { status: 'SHIPPED' }
  ) {
    return this.ordersService.updateDeliveryStatus(id, status);
  }
}