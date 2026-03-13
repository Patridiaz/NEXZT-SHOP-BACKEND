import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { DeliveryStatus, Order, OrderStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { CreditNote } from './credit-note.entity';
import { CartService } from '../cart/cart.service';
import { User, UserRole } from '../users/user.entity'; // ✅ Importamos UserRole
import { CartItem } from 'src/cart/cart.entity';
import { Product } from 'src/products/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { Region } from 'src/locations/region.entity';
import { Commune } from 'src/locations/commune.entity';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    private cartService: CartService,
    private entityManager: EntityManager,
    @InjectRepository(Region) private regionRepo: Repository<Region>,
    @InjectRepository(Commune) private communeRepo: Repository<Commune>,
    @InjectRepository(CreditNote) private creditNoteRepo: Repository<CreditNote>,
    private mailService: MailService,
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

      // Generar código de pedido con prefijo
      savedOrder.orderCode = `NEXTZ-${String(savedOrder.id).padStart(6, '0')}`;
      await transactionalEntityManager.save(savedOrder);

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
    const savedOrder = await this.ordersRepo.save(order);

    // Cargar usuario para obtener email
    const fullOrder = await this.ordersRepo.findOne({ where: { id: orderId }, relations: ['user'] });
    const userEmail = fullOrder?.user?.email || fullOrder?.guestEmail;
    const userName = fullOrder?.user?.name || 'Cliente';

    if (userEmail) {
      this.mailService.sendOrderStatusUpdateEmail(userEmail, userName, order.orderCode, status).catch(() => { });
    }

    return savedOrder;
  }

  async cancelOrder(orderId: number, reason: string, adminEmail: string): Promise<CreditNote> {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['user', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(`La orden #${orderId} ya está cancelada`);
    }

    // 1. Cambiar estado a CANCELADO
    order.status = OrderStatus.CANCELLED;
    await this.ordersRepo.save(order);

    // 2. Reponer stock si la orden estaba pagada
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.product) {
          await this.entityManager.increment(
            Product,
            { id: item.product.id },
            'stock',
            item.quantity,
          );
        }
      }
    }

    // 3. Crear nota de crédito
    const customerEmail = order.user?.email || order.guestEmail || '';
    const creditNote = this.creditNoteRepo.create({
      order,
      amount: order.total,
      reason,
      customerEmail,
      customerPhone: order.user?.phone || undefined,
      cancelledBy: adminEmail,
    });
    const savedNote = await this.creditNoteRepo.save(creditNote);

    // Generar código de nota de crédito con prefijo NC-
    savedNote.noteCode = `NC-${String(savedNote.id).padStart(6, '0')}`;
    await this.creditNoteRepo.save(savedNote);

    // 4. Enviar email de cancelación
    const userName = order.user?.name || 'Cliente';
    if (customerEmail) {
      this.mailService.sendOrderCancelledEmail(
        customerEmail,
        userName,
        order.orderCode,
        Number(order.total),
        reason,
      ).catch(() => { });
    }

    return savedNote;
  }

  async getCreditNotesByOrder(orderId: number): Promise<CreditNote[]> {
    return this.creditNoteRepo.find({
      where: { order: { id: orderId } },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllCreditNotes(): Promise<CreditNote[]> {
    return this.creditNoteRepo.find({
      relations: ['order'],
      order: { createdAt: 'DESC' },
    });
  }

  async generateCreditNotePdf(creditNoteId: number): Promise<Buffer> {
    const creditNote = await this.creditNoteRepo.findOne({
      where: { id: creditNoteId },
      relations: ['order', 'order.items', 'order.items.product', 'order.user'],
    });

    if (!creditNote) {
      throw new NotFoundException(`Nota de crédito con ID ${creditNoteId} no encontrada`);
    }

    const order = creditNote.order;
    const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n);
    const formatDate = (d: Date) => new Date(d).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const logoPath = path.join(process.cwd(), 'uploads', 'logo Next Z.png');

      // === HEADER ===
      doc.rect(0, 0, doc.page.width, 100).fill('#c8102e');

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 20, { height: 60 });
      } else {
        doc.fontSize(28).fillColor('#ffffff').text('NEXTZ', 50, 25, { align: 'left' });
      }

      doc.fillColor('#ffffff');
      doc.fontSize(10).text('Comprobante oficial de anulación', 50, 80, { align: 'left' });
      doc.fontSize(20).text('NOTA DE CRÉDITO', 0, 35, { align: 'right', width: doc.page.width - 50 });
      doc.fontSize(14).text(`${creditNote.noteCode || 'NC-' + creditNote.id}`, 0, 65, { align: 'right', width: doc.page.width - 50 });

      doc.moveDown(4);
      doc.fillColor('#000000');

      // === INFO NOTA DE CRÉDITO ===
      const startY = 130;
      doc.fontSize(10).fillColor('#666666');
      doc.text('Fecha de emisión:', 50, startY);
      doc.fillColor('#000000').text(formatDate(creditNote.createdAt), 180, startY);

      doc.fillColor('#666666').text('N° Pedido asociado:', 50, startY + 20);
      doc.fillColor('#000000').text(`${order.orderCode}`, 180, startY + 20);

      doc.fillColor('#666666').text('Cliente:', 50, startY + 40);
      doc.fillColor('#000000').text(creditNote.customerEmail, 180, startY + 40);

      if (creditNote.customerPhone) {
        doc.fillColor('#666666').text('Teléfono:', 50, startY + 60);
        doc.fillColor('#000000').text(creditNote.customerPhone, 180, startY + 60);
      }

      doc.fillColor('#666666').text('Cancelado por:', 50, startY + 80);
      doc.fillColor('#000000').text(creditNote.cancelledBy, 180, startY + 80);

      // === MOTIVO ===
      doc.moveDown(2);
      const reasonY = startY + 115;
      doc.rect(50, reasonY, doc.page.width - 100, 50).fill('#fff3cd');
      doc.fontSize(9).fillColor('#856404').text('Motivo de cancelación:', 60, reasonY + 10);
      doc.fontSize(10).text(creditNote.reason, 60, reasonY + 25, { width: doc.page.width - 120 });

      // === TABLA DE PRODUCTOS ===
      let tableY = reasonY + 80;
      doc.rect(50, tableY, doc.page.width - 100, 25).fill('#f5f5f5');
      doc.fontSize(9).fillColor('#333333');
      doc.text('Producto', 60, tableY + 7, { width: 200 });
      doc.text('Cant.', 300, tableY + 7, { width: 50, align: 'center' });
      doc.text('Precio Unit.', 360, tableY + 7, { width: 90, align: 'right' });
      doc.text('Subtotal', 460, tableY + 7, { width: 80, align: 'right' });

      tableY += 25;
      doc.fillColor('#000000');

      if (order.items) {
        for (const item of order.items) {
          const name = item.product?.name || 'Producto eliminado';
          doc.fontSize(9);
          doc.text(name, 60, tableY + 5, { width: 230 });
          doc.text(String(item.quantity), 300, tableY + 5, { width: 50, align: 'center' });
          doc.text(formatCLP(Number(item.price)), 360, tableY + 5, { width: 90, align: 'right' });
          doc.text(formatCLP(Number(item.price) * item.quantity), 460, tableY + 5, { width: 80, align: 'right' });

          tableY += 22;
          doc.moveTo(50, tableY).lineTo(doc.page.width - 50, tableY).strokeColor('#eeeeee').stroke();
        }
      }

      // === TOTALES ===
      tableY += 15;
      if (Number(order.shippingCost) > 0) {
        doc.fontSize(10).fillColor('#666666').text('Costo Envío:', 360, tableY, { width: 90, align: 'right' });
        doc.fillColor('#000000').text(formatCLP(Number(order.shippingCost)), 460, tableY, { width: 80, align: 'right' });
        tableY += 20;
      }

      doc.rect(350, tableY - 5, 195, 30).fill('#c8102e');
      doc.fontSize(12).fillColor('#ffffff');
      doc.text('TOTAL NOTA:', 360, tableY + 2, { width: 90, align: 'right' });
      doc.text(formatCLP(Number(creditNote.amount)), 460, tableY + 2, { width: 80, align: 'right' });

      // === FOOTER ===
      const footerY = doc.page.height - 80;
      doc.rect(0, footerY, doc.page.width, 80).fill('#f39c12');
      doc.fontSize(9).fillColor('#ffffff');
      doc.text('Nextz se pondrá en contacto contigo vía telefónica o email para coordinar la devolución de tu dinero.', 50, footerY + 15, { align: 'center', width: doc.page.width - 100 });
      doc.text(`© ${new Date().getFullYear()} Nextz. Todos los derechos reservados.`, 50, footerY + 40, { align: 'center', width: doc.page.width - 100 });

      doc.end();
    });
  }

  async generateOrderPdf(orderId: number): Promise<Buffer> {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'user', 'region', 'commune'],
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n);
    const formatDate = (d: Date) => new Date(d).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const logoPath = path.join(process.cwd(), 'uploads', 'logo Next Z.png');

      // === HEADER ===
      doc.rect(0, 0, doc.page.width, 100).fill('#c8102e');

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 20, { height: 60 });
      } else {
        doc.fontSize(28).fillColor('#ffffff').text('NEXTZ', 50, 25, { align: 'left' });
      }

      doc.fillColor('#ffffff');
      doc.fontSize(10).text('Comprobante oficial de compra', 50, 80, { align: 'left' });
      doc.fontSize(20).text('ORDEN DE COMPRA', 0, 35, { align: 'right', width: doc.page.width - 50 });
      doc.fontSize(14).text(`${order.orderCode || '#' + order.id}`, 0, 65, { align: 'right', width: doc.page.width - 50 });

      doc.moveDown(4);
      doc.fillColor('#000000');

      // === INFO PEDIDO ===
      const startY = 130;
      doc.fontSize(10).fillColor('#666666');
      doc.text('Fecha de emisión:', 50, startY);
      doc.fillColor('#000000').text(formatDate(order.createdAt), 180, startY);

      doc.fillColor('#666666').text('Estado del pedido:', 50, startY + 20);
      doc.fillColor('#000000').text(`${order.status}`, 180, startY + 20);

      doc.fillColor('#666666').text('Cliente:', 50, startY + 40);
      doc.fillColor('#000000').text(order.user?.email || order.guestEmail || 'N/A', 180, startY + 40);

      doc.fillColor('#666666').text('Dirección de Envío:', 50, startY + 60);
      doc.fillColor('#000000').text(`${order.shippingAddress}, ${order.commune?.name || ''}, ${order.region?.name || ''}`, 180, startY + 60, { width: 350 });

      // === TABLA DE PRODUCTOS ===
      let tableY = startY + 110;
      doc.rect(50, tableY, doc.page.width - 100, 25).fill('#f5f5f5');
      doc.fontSize(9).fillColor('#333333');
      doc.text('Producto', 60, tableY + 7, { width: 200 });
      doc.text('Cant.', 300, tableY + 7, { width: 50, align: 'center' });
      doc.text('Precio Unit.', 360, tableY + 7, { width: 90, align: 'right' });
      doc.text('Subtotal', 460, tableY + 7, { width: 80, align: 'right' });

      tableY += 25;
      doc.fillColor('#000000');

      if (order.items) {
        for (const item of order.items) {
          const name = item.product?.name || 'Producto eliminado';
          doc.fontSize(9);
          doc.text(name, 60, tableY + 5, { width: 230 });
          doc.text(String(item.quantity), 300, tableY + 5, { width: 50, align: 'center' });
          doc.text(formatCLP(Number(item.price)), 360, tableY + 5, { width: 90, align: 'right' });
          doc.text(formatCLP(Number(item.price) * item.quantity), 460, tableY + 5, { width: 80, align: 'right' });

          tableY += 22;
          doc.moveTo(50, tableY).lineTo(doc.page.width - 50, tableY).strokeColor('#eeeeee').stroke();
        }
      }

      // === TOTALES ===
      tableY += 15;
      const subtotal = order.items.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);

      doc.fontSize(10).fillColor('#666666').text('Subtotal:', 360, tableY, { width: 90, align: 'right' });
      doc.fillColor('#000000').text(formatCLP(subtotal), 460, tableY, { width: 80, align: 'right' });
      tableY += 20;

      if (Number(order.shippingCost) > 0) {
        doc.fontSize(10).fillColor('#666666').text('Costo Envío:', 360, tableY, { width: 90, align: 'right' });
        doc.fillColor('#000000').text(formatCLP(Number(order.shippingCost)), 460, tableY, { width: 80, align: 'right' });
        tableY += 20;
      }

      doc.rect(350, tableY - 5, 195, 30).fill('#c8102e');
      doc.fontSize(12).fillColor('#ffffff');
      doc.text('TOTAL:', 360, tableY + 2, { width: 90, align: 'right' });
      doc.text(formatCLP(Number(order.total)), 460, tableY + 2, { width: 80, align: 'right' });

      // === FOOTER ===
      const footerY = doc.page.height - 60;
      doc.rect(0, footerY, doc.page.width, 60).fill('#f39c12');
      doc.fontSize(10).fillColor('#ffffff');
      doc.text('Gracias por preferir Nextz.', 50, footerY + 15, { align: 'center', width: doc.page.width - 100 });
      doc.text(`© ${new Date().getFullYear()} Nextz. Todos los derechos reservados.`, 50, footerY + 35, { align: 'center', width: doc.page.width - 100 });

      doc.end();
    });
  }
}
