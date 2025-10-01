import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Order, OrderStatus } from './order.entity'; // ✅ 1. Importa OrderStatus
import { OrderItem } from './order-item.entity';
import { CartService } from '../cart/cart.service';
import { User } from '../users/user.entity';
import { CartItem } from 'src/cart/cart.entity';
import { Product } from 'src/products/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    private cartService: CartService,
    private entityManager: EntityManager,
  ) {}

async createOrder(dto: CreateOrderDto, userId?: number): Promise<Order> {
  return this.entityManager.transaction(async transactionalEntityManager => {
    let cartItems: { product: Product; quantity: number }[];
    let user: User | null = null;

    // --- 1. OBTENER ITEMS DEL CARRITO ---
    if (userId) {
      // Caso: Usuario registrado
      user = await transactionalEntityManager.findOneBy(User, { id: userId });
      if (!user) throw new NotFoundException('Usuario no encontrado.');
      
      const userCart = await transactionalEntityManager.find(CartItem, { 
        where: { user: { id: userId } }, 
        relations: ['product'] 
      });
      cartItems = userCart;

    } else {
      // Caso: Invitado
      if (!dto.guestCart || dto.guestCart.length === 0 || !dto.shippingAddress) {
        throw new BadRequestException('Faltan datos del invitado o el carrito está vacío.');
      }
      const productIds = dto.guestCart.map(item => item.productId);
      const products = await transactionalEntityManager.findByIds(Product, productIds);
      const productMap = new Map(products.map(p => [p.id, p]));

      // ✅ CORRECCIÓN 1: Se mapean los productos y se verifica que no sean 'undefined'
      const potentialCartItems = dto.guestCart.map(item => ({
        product: productMap.get(item.productId),
        quantity: item.quantity,
      }));

      // ✅ CORRECCIÓN 2: Se lanza un error si algún producto del carrito es inválido
      if (potentialCartItems.some(item => !item.product)) {
        throw new BadRequestException('Uno o más productos en el carrito son inválidos o fueron eliminados.');
      }
      
      // Ahora es seguro asignar, ya que todos los productos existen.
      cartItems = potentialCartItems as { product: Product; quantity: number }[];
    }

    if (cartItems.length === 0) {
      throw new BadRequestException('El carrito está vacío.');
    }

    // --- 2. VALIDACIÓN DE STOCK ---
    for (const item of cartItems) {
      const product = await transactionalEntityManager.findOne(Product, {
        where: { id: item.product.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product || product.stock < item.quantity) {
        throw new BadRequestException(`Stock insuficiente para '${item.product.name}'. Solo quedan ${product?.stock || 0} unidades.`);
      }
    }

    // --- 3. CREAR LA ORDEN ---
    const orderItems = cartItems.map(item => {
      const orderItem = new OrderItem();
      orderItem.product = item.product;
      orderItem.quantity = item.quantity;
      orderItem.price = item.product.offerPrice ?? item.product.price;
      return orderItem;
    });

    const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const order = new Order();
    order.items = orderItems;
    order.total = total;
    order.status = OrderStatus.PENDING;
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    order.expiresAt = expiresAt;

    if (user) {
      order.user = user;
      order.shippingAddress = dto.shippingAddress!;
    } else {
      order.guestEmail = dto.guestEmail!; 
      order.shippingAddress = dto.shippingAddress!;
    }

    const savedOrder = await transactionalEntityManager.save(order);
    
    // --- 4. DESCONTAR STOCK Y LIMPIAR CARRITO ---
    for (const item of cartItems) {
      await transactionalEntityManager.decrement(Product, { id: item.product.id }, 'stock', item.quantity);
    }
    if (userId) {
      await transactionalEntityManager.delete(CartItem, { user: { id: userId } });
    }

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