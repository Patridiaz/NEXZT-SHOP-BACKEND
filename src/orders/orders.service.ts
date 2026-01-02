import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { DeliveryStatus, Order, OrderStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { CartService } from '../cart/cart.service';
import { User, UserRole } from '../users/user.entity'; // ✅ Importamos UserRole
import { CartItem } from 'src/cart/cart.entity';
import { Product } from 'src/products/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { Region } from 'src/locations/region.entity';
import { Commune } from 'src/locations/commune.entity';
import * as bcrypt from 'bcrypt'; // ✅ Importamos bcrypt para hashear passwords

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    private cartService: CartService,
    private entityManager: EntityManager,
    @InjectRepository(Region) private regionRepo: Repository<Region>,
    @InjectRepository(Commune) private communeRepo: Repository<Commune>,
  ) { }

  async createOrder(dto: CreateOrderDto, userId?: number): Promise<Order> {
    return this.entityManager.transaction(async transactionalEntityManager => {

      let cartItems: { product: Product; quantity: number }[];
      let user: User | null = null;

      // =================================================================
      // 1. IDENTIFICACIÓN DE USUARIO Y CARGA DE CARRITO
      // =================================================================

      // CASO A: Usuario ya logueado (Viene con Token/ID)
      if (userId) {
        user = await transactionalEntityManager.findOneBy(User, { id: userId });
        if (!user) throw new NotFoundException('Usuario no encontrado.');

        // Carga carrito desde base de datos
        const userCart = await transactionalEntityManager.find(CartItem, {
          where: { user: { id: userId } },
          relations: ['product']
        });
        cartItems = userCart;
      }

      // CASO B: Invitado que quiere CREAR CUENTA (Viene Password + Email)
      else if (dto.password && dto.guestEmail) {
        // 1. Validar si el correo ya existe
        const existingUser = await transactionalEntityManager.findOneBy(User, { email: dto.guestEmail });
        if (existingUser) {
          throw new BadRequestException('El correo ya está registrado. Por favor inicia sesión.');
        }

        // 2. Crear usuario nuevo
        const newUser = new User();
        newUser.email = dto.guestEmail;
        newUser.password = await bcrypt.hash(dto.password, 10); // Hashear password
        newUser.name = dto.fullName || 'Usuario';
        newUser.rut = dto.rut || null;
        newUser.phone = dto.phone || null;
        newUser.role = UserRole.CUSTOMER;

        // 3. Guardar usuario (dentro de la transacción)
        user = await transactionalEntityManager.save(newUser);

        // 4. Cargar items del carrito desde el DTO (payload)
        cartItems = await this.getProductsFromDto(dto, transactionalEntityManager);
      }

      // CASO C: Invitado Puro (Sin Password)
      else {
        // Cargar items del carrito desde el DTO (payload)
        cartItems = await this.getProductsFromDto(dto, transactionalEntityManager);
      }

      if (cartItems.length === 0) throw new BadRequestException('El carrito está vacío.');

      // =================================================================
      // 2. VALIDACIÓN DE STOCK
      // =================================================================
      for (const item of cartItems) {
        const product = await transactionalEntityManager.findOne(Product, {
          where: { id: item.product.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) {
          throw new BadRequestException(`Producto '${item.product.name}' no encontrado.`);
        }

        if (product.purchaseLimit && item.quantity > product.purchaseLimit) {
          throw new BadRequestException(
            `No puedes comprar más de ${product.purchaseLimit} unidades de '${product.name}'.`,
          );
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(`Stock insuficiente para '${product.name}'.`);
        }
      }

      // =================================================================
      // 3. CREAR ITEMS DE LA ORDEN
      // =================================================================
      const orderItems = cartItems.map(item => {
        const orderItem = new OrderItem();
        orderItem.product = item.product;
        orderItem.quantity = item.quantity;
        orderItem.price = (item.product.offerPrice && item.product.offerPrice > 0)
          ? item.product.offerPrice : item.product.price;
        return orderItem;
      });

      // =================================================================
      // 4. CALCULAR TOTALES
      // =================================================================
      const subtotal = orderItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

      const order = new Order();
      order.items = orderItems;
      order.status = OrderStatus.PENDING;

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);
      order.expiresAt = expiresAt;

      // =================================================================
      // 5. ASIGNAR REGIÓN, COMUNA Y ENVÍO
      // =================================================================
      let shippingCost = 0;

      if (dto.regionName) {
        const region = await this.regionRepo.findOneBy({ name: dto.regionName });
        if (region) order.region = region;
      }

      if (dto.communeName) {
        const commune = await this.communeRepo.findOneBy({ name: dto.communeName });
        if (!commune) {
          throw new BadRequestException(`La comuna '${dto.communeName}' no es válida.`);
        }
        order.commune = commune;

        // Lógica de Cobro: Si es NULL es Starken ($0), si tiene número es Tarifa Fija.
        if (commune.fixedShippingCost !== null) {
          shippingCost = Number(commune.fixedShippingCost);
        }
      }

      order.shippingCost = shippingCost;
      order.total = subtotal + shippingCost;

      // =================================================================
      // 6. ASIGNAR USUARIO A LA ORDEN
      // =================================================================
      order.shippingAddress = dto.shippingAddress!; // Siempre guardamos la dirección escrita

      if (user) {
        // Si hay usuario (Logueado o Recién Creado)
        order.user = user;
        order.userId = user.id; // Vinculación
        order.guestEmail = null; // No es guest puro
      } else {
        // Invitado puro
        order.user = null;
        order.userId = null;
        order.guestEmail = dto.guestEmail!;
      }

      // Guardar Orden
      const savedOrder = await transactionalEntityManager.save(order);

      // Si era usuario logueado, limpiamos su carrito de BD
      if (userId) {
        await transactionalEntityManager.delete(CartItem, { user: { id: userId } });
      }

      return savedOrder;
    });
  }

  // ✅ Helper privado para no repetir código de lectura del carrito de invitado
  private async getProductsFromDto(dto: CreateOrderDto, manager: EntityManager) {
    if (!dto.guestCart || dto.guestCart.length === 0 || !dto.shippingAddress) {
      throw new BadRequestException('Faltan datos del invitado o el carrito está vacío.');
    }
    const productIds = dto.guestCart.map(item => item.productId);
    const products = await manager.findByIds(Product, productIds);
    const productMap = new Map(products.map(p => [p.id, p]));

    const potentialItems = dto.guestCart.map(item => ({
      product: productMap.get(item.productId),
      quantity: item.quantity,
    }));

    if (potentialItems.some(item => !item.product)) {
      throw new BadRequestException('Productos inválidos en el carrito.');
    }
    return potentialItems as { product: Product; quantity: number }[];
  }

  // --- MÉTODOS DE BÚSQUEDA (Sin cambios) ---

  async findOrdersByUser(user: User) {
    return this.ordersRepo.find({
      where: { user: { id: user.id } },
      relations: ['items', 'items.product', 'region', 'commune'],
      order: { createdAt: 'DESC' }
    });
  }

  async findOrderById(orderId: number) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'region', 'commune']
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  async updateOrderStatus(orderId: number, status: OrderStatus) {
    const result = await this.ordersRepo.update(orderId, { status });
    if (result.affected === 0) throw new NotFoundException('Orden no encontrada');
    return this.findOrderById(orderId);
  }

  async findAll() {
    return this.ordersRepo.find({
      relations: ['user', 'items', 'items.product', 'region', 'commune'],
      order: { createdAt: 'DESC' }
    });
  }

  async updateDeliveryStatus(orderId: number, status: DeliveryStatus): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    order.deliveryStatus = status;
    return this.ordersRepo.save(order);
  }
}