import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cartService: CartService) {}

  @Post('add')
  addToCart(@Req() req, @Body() body: { productId: number; quantity: number }) {
    // ✅ Pasa solo el ID del usuario, no el objeto completo
    return this.cartService.addItemToCart(req.user.id, body.productId, body.quantity);
  }

  @Get()
  getCart(@Req() req) {
    // ✅ Pasa solo el ID del usuario
    return this.cartService.findCartByUser(req.user.id);
  }

  @Get('user/:id')
  async getCartByUser(@Param('id', ParseIntPipe) userId: number) {
    return this.cartService.findCartByUser(userId);
  }

  @Delete(':productId')
  removeFromCart(@Req() req, @Param('productId', ParseIntPipe) productId: number) {
    // ✅ Pasa solo el ID del usuario
    return this.cartService.removeItem(req.user.id, productId);
  }
}