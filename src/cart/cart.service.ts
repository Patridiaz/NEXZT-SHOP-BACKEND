import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'; // ✅ 1. Importa NotFoundException
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './cart.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { GuestCartItem } from './guest-cart-item.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>,
    @InjectRepository(GuestCartItem) private guestCartItemRepo: Repository<GuestCartItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}


// --- MÉTODOS PÚBLICOS ---

  async addItem(data: { userId?: number; guestCartId?: string; productId: number; quantity: number }) {
    const { userId, guestCartId, productId, quantity } = data;

    const product = await this.findProduct(productId);

    if (userId) {
      const user = await this.findUser(userId);
      return this.handleUserCartItem(user, product, quantity);
    } 
    if (guestCartId) {
      return this.handleGuestCartItem(guestCartId, product, quantity);
    }
    
    throw new BadRequestException('Se requiere identificación de usuario o de invitado.');
  }

  async getCart(userId?: number, guestCartId?: string) {
    if (userId) {
      return this.cartItemRepo.find({
        where: { user: { id: userId } },
        relations: ['product', 'product.brand'],
      });
    } 
    if (guestCartId) {
      return this.guestCartItemRepo.find({
        where: { guestId: guestCartId },
        relations: ['product', 'product.brand'],
      });
    }
    return [];
  }

private async handleUserCartItem(user: User, product: Product, quantityToAdd: number) {
    // ✅ INICIO: LÓGICA DE LÍMITE DE 6 ITEMS PARA USUARIOS
    const userCartItems = await this.cartItemRepo.find({ where: { user: { id: user.id } } });
    const currentTotalQuantity = userCartItems.reduce((sum, item) => sum + item.quantity, 0);

    if (currentTotalQuantity + quantityToAdd > 6) {
      throw new BadRequestException(
        `No puedes tener más de 6 items en tu carrito. Actualmente tienes ${currentTotalQuantity}.`
      );
    }
    // ✅ FIN: LÓGICA DE LÍMITE

    const cartItem = await this.cartItemRepo.findOne({
      where: { user: { id: user.id }, product: { id: product.id } },
    });

    const newQuantity = (cartItem ? cartItem.quantity : 0) + quantityToAdd;
    if (product.stock < newQuantity) {
      throw new BadRequestException(`Stock insuficiente para '${product.name}'.`);
    }

    if (cartItem) {
      cartItem.quantity = newQuantity;
      return this.cartItemRepo.save(cartItem);
    } 
      
    const newCartItem = this.cartItemRepo.create({ user, product, quantity: quantityToAdd });
    return this.cartItemRepo.save(newCartItem);
  }

  private async handleGuestCartItem(guestId: string, product: Product, quantityToAdd: number) {
    // ✅ INICIO: LÓGICA DE LÍMITE DE 6 ITEMS PARA INVITADOS
    const guestCartItems = await this.guestCartItemRepo.find({ where: { guestId } });
    const currentTotalQuantity = guestCartItems.reduce((sum, item) => sum + item.quantity, 0);

    if (currentTotalQuantity + quantityToAdd > 6) {
      throw new BadRequestException(
        `No puedes tener más de 6 items en tu carrito. Actualmente tienes ${currentTotalQuantity}.`
      );
    }
    // ✅ FIN: LÓGICA DE LÍMITE

    const cartItem = await this.guestCartItemRepo.findOne({
      where: { guestId, product: { id: product.id } },
    });

    const newQuantity = (cartItem ? cartItem.quantity : 0) + quantityToAdd;
    if (product.stock < newQuantity) {
      throw new BadRequestException(`Stock insuficiente para '${product.name}'.`);
    }

    if (cartItem) {
      cartItem.quantity = newQuantity;
      return this.guestCartItemRepo.save(cartItem);
    } 
      
    const newCartItem = this.guestCartItemRepo.create({ guestId, product, quantity: quantityToAdd });
    return this.guestCartItemRepo.save(newCartItem);
  }
  
  private async findProduct(id: number): Promise<Product> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado.`);
    }
    return product;
  }
  
  private async findUser(id: number): Promise<User> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }
    return user;
  }





  // Eliminar un producto del carrito
  async removeItem(userId: number, productId: number) { // ✅ 2. Ya era consistente
    const cartItem = await this.cartItemRepo.findOne({
      where: { user: { id: userId }, product: { id: productId } }
    });
    
    if (cartItem) {
      await this.cartItemRepo.remove(cartItem);
    } else {
      // Opcional: Lanza un error si se intenta borrar un item que no existe
      throw new NotFoundException(`Item con producto ID ${productId} no encontrado en el carrito.`);
    }

    return this.getCart(userId);
}


  // Vaciar todo el carrito
  async removeAllFromUser(userId: number) {
    // Esta consulta es más eficiente que traer todos los items y luego borrarlos
    await this.cartItemRepo.delete({ user: { id: userId } });
    return { message: 'Carrito vaciado' };
  }
}