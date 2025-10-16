import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { Public } from 'src/auth/public.decorator';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt-auth.guard';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cartService: CartService) {}

  @Post('add')
  @UseGuards(OptionalJwtAuthGuard) // ✅ 2. Usa el guard opcional
  async addItemToCart(@Req() req, @Body() addToCartDto: AddToCartDto) {
    // ✅ 3. Obtén el userId SI EXISTE, si no, será undefined
    const userId = req.user?.id; 
    
    // El DTO ahora puede incluir un guestCartId opcional
    const guestCartId = addToCartDto.guestCartId;

    return this.cartService.addItem({ userId, guestCartId, ...addToCartDto });
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard) // ✅ Usa el guard opcional también aquí
  async getCart(@Req() req, @Body() body: { guestCartId?: string }) {
    const userId = req.user?.id;
    const guestCartId = body.guestCartId;
    return this.cartService.getCart(userId, guestCartId);
  }
  @Public()
  @Get('user/:id')
  async getCartByUser(@Param('id', ParseIntPipe) userId: number) {
    return this.cartService.getCart(userId);
  }

  @Delete(':productId')
  removeFromCart(@Req() req, @Param('productId', ParseIntPipe) productId: number) {
    // ✅ Pasa solo el ID del usuario
    return this.cartService.removeItem(req.user.id, productId);
  }
}