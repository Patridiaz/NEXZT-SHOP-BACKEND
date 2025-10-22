import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,        // Import Request
  Res,        // Import Response
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import express from 'express'; // Import Express types
import { v4 as uuidv4 } from 'uuid';       // For generating guest IDs
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt-auth.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserRequestData } from 'src/auth/user-request.interface';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  // Helper to get or create guestCartId and set cookie
  private getOrCreateGuestId(req: express.Request, res: express.Response): string {
    let guestCartId = req.cookies?.guestCartId;
    if (!guestCartId) {
      guestCartId = uuidv4();
      res.cookie('guestCartId', guestCartId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }
    return guestCartId;
  }

  @Post('add')
  @UseGuards(OptionalJwtAuthGuard) // Allows guests and logged-in users
  @HttpCode(HttpStatus.OK) // Return 200 OK instead of 201 Created for adding/updating
  async addItemToCart(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
    @Body() addToCartDto: AddToCartDto,
  ) {
    const userData = req.user as UserRequestData; 
    const userId = userData.id;// From JWT payload if logged in
    let guestCartId: string | undefined = undefined;

    // If not logged in, get or create the guest ID from cookies
    if (!userId) {
      guestCartId = this.getOrCreateGuestId(req, res);
    }

    // Call the service with either userId OR guestCartId
    return this.cartService.addItem({
      userId,
      guestCartId,
      productId: addToCartDto.productId,
      quantity: addToCartDto.quantity,
    });
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard) // Allows guests and logged-in users
  async getCart(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const userData = req.user as UserRequestData; 
    const userId = userData.id;
    let guestCartId: string | undefined = undefined;

    // If not logged in, get or create the guest ID from cookies
    if (!userId) {
      guestCartId = this.getOrCreateGuestId(req, res);
      // If it's a brand new guest, the cart service will return empty anyway
    }

    // Call service with either userId OR guestCartId
    return this.cartService.getCart(userId, guestCartId);
  }

  // This route seems redundant if the main GET /cart handles logged-in users.
  // Also, @Public contradicts the class-level guard if it existed.
  // Kept for now, assuming it might serve a specific admin purpose?
  // If not, consider removing it.
  // @Public() // If intended public, remove UseGuards(JwtAuthGuard) from class level
  // @Get('user/:id')
  // async getCartByUser(@Param('id', ParseIntPipe) userId: number) {
  //   return this.cartService.getCart(userId);
  // }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard) // ONLY logged-in users can remove items this way
  async removeFromCart(
    @Req() req: express.Request,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const userData = req.user as UserRequestData; 
    const userId = userData.id;
    return this.cartService.removeItem(userId, productId);
  }

  @Delete() // Route for clearing the entire cart
  @UseGuards(JwtAuthGuard) // ONLY logged-in users
  @HttpCode(HttpStatus.NO_CONTENT) // Return 204 No Content on successful clear
  async clearCart(@Req() req: express.Request) {
    const userData = req.user as UserRequestData; 
    const userId = userData.id;
    await this.cartService.removeAllFromUser(userId);
    // No need to return anything specific, 204 implies success
  }
}