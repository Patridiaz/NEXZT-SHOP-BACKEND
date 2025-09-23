import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Order, OrderStatus } from './order.entity'; // ✅ 1. Importa OrderStatus
import { OrderItem } from './order-item.entity';
import { CartService } from '../cart/cart.service';
import { User } from '../users/user.entity';
import { CartItem } from 'src/cart/cart.entity';
import { Product } from 'src/products/product.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    private cartService: CartService,
    private entityManager: EntityManager,
  ) {}

async createOrder(user: User): Promise<Order> {
    // La transacción asegura que todas las operaciones (verificar stock, crear orden)
    // se completen exitosamente, o ninguna lo hará.
    return this.entityManager.transaction(async transactionalEntityManager => {
      const cartItems = await this.cartService.findCartByUser(user.id);
      if (cartItems.length === 0) {
        throw new BadRequestException('El carrito está vacío.');
      }

      // --- ✅ INICIO DEL BLOQUE DE VALIDACIÓN DE STOCK ---
      for (const cartItem of cartItems) {
        // Buscamos el producto dentro de la transacción y lo bloqueamos para evitar
        // que otro proceso lo modifique mientras estamos en el checkout.
        const product = await transactionalEntityManager.findOne(Product, {
          where: { id: cartItem.product.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`El producto '${cartItem.product.name}' ya no está disponible.`);
        }
        
        // Comparamos el stock actual con la cantidad en el carrito
        if (product.stock < cartItem.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para '${product.name}'. Solo quedan ${product.stock} unidades.`
          );
        }
      }
      // --- ✅ FIN DEL BLOQUE DE VALIDACIÓN DE STOCK ---



      const orderItems: OrderItem[] = cartItems.map(ci => {
        const orderItem = new OrderItem();
        orderItem.product = ci.product;
        orderItem.quantity = ci.quantity;
        orderItem.price = ci.product.offerPrice ?? ci.product.price;
        return orderItem;
      });

      const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const order = new Order();
      order.user = user;
      order.items = orderItems;
      order.total = total;
      order.status = OrderStatus.PENDING; 
      
      // ✅ Asigna la fecha de expiración
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);
      order.expiresAt = expiresAt;

      const savedOrder = await transactionalEntityManager.save(order);
      
      // Limpiamos el carrito del usuario, pero dentro de la misma transacción
      await transactionalEntityManager.delete(CartItem, { user: { id: user.id } });

      return savedOrder;
    });
  }

  async findOrdersByUser(user: User) {
    return this.ordersRepo.find({ 
      where: { user: { id: user.id } },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' }
    });
  }

  async findOrderById(orderId: number) {
    const order = await this.ordersRepo.findOne({ 
      where: { id: orderId }, 
      relations: ['items', 'items.product'] 
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  // ✅ 3. Cambia el tipo del parámetro 'status' de string a OrderStatus
  async updateOrderStatus(orderId: number, status: OrderStatus) {
    const result = await this.ordersRepo.update(orderId, { status });
    if (result.affected === 0) {
      throw new NotFoundException('Orden no encontrada');
    }
    return this.findOrderById(orderId);
  }
}