import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'; // ✅ 1. Importa NotFoundException
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './cart.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
  ) {}

/**
   * ✅ MÉTODO MEJORADO con la validación del límite total de items.
   */
  async addItemToCart(user: User, productId: number, quantityToAdd: number): Promise<CartItem> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado.`);
    }

    // --- ✅ INICIO DEL BLOQUE DE VALIDACIÓN DEL LÍMITE ---
    // 1. Buscamos todos los items actuales en el carrito del usuario.
    const userCartItems = await this.cartItemRepo.find({ where: { user: { id: user.id } } });
    
    // 2. Calculamos la cantidad total de items que ya tiene.
    const currentTotalQuantity = userCartItems.reduce((sum, item) => sum + item.quantity, 0);

    // 3. Verificamos si la nueva cantidad excedería el límite de 6.
    if (currentTotalQuantity + quantityToAdd > 6) {
      throw new BadRequestException(
        `No puedes tener más de 6 items en tu carrito. Actualmente tienes ${currentTotalQuantity}.`
      );
    }
    // --- ✅ FIN DEL BLOQUE DE VALIDACIÓN DEL LÍMITE ---

    // El resto de la lógica de stock por producto sigue igual.
    const cartItem = await this.cartItemRepo.findOne({
      where: { user: { id: user.id }, product: { id: productId } },
    });

    const currentQtyInCart = cartItem ? cartItem.quantity : 0;
    const requestedTotalQty = currentQtyInCart + quantityToAdd;

    if (product.stock < requestedTotalQty) {
      const available = product.stock - currentQtyInCart;
      throw new BadRequestException(
        `Stock insuficiente para '${product.name}'. Solo puedes añadir ${available > 0 ? available : 0} unidades más.`
      );
    }

    // Lógica para añadir o actualizar el item en el carrito.
    if (cartItem) {
      cartItem.quantity = requestedTotalQty;
      return this.cartItemRepo.save(cartItem);
    } else {
      const newCartItem = this.cartItemRepo.create({ user, product, quantity: quantityToAdd });
      return this.cartItemRepo.save(newCartItem);
    }
  }  
  // Listar carrito de un usuario
  async findCartByUser(userId: number) {
    return this.cartItemRepo.find({
      where: { user: { id: userId } },
      // ✅ 3. Carga el producto y también la marca del producto
      relations: ['product', 'product.brand'], 
    });
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

    return this.findCartByUser(userId);
}


  // Vaciar todo el carrito
  async removeAllFromUser(userId: number) {
    // Esta consulta es más eficiente que traer todos los items y luego borrarlos
    await this.cartItemRepo.delete({ user: { id: userId } });
    return { message: 'Carrito vaciado' };
  }
}