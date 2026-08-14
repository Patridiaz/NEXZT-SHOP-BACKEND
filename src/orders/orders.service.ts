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
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const logoPath = path.join(process.cwd(), 'uploads', 'logo Next Z.png');
      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      // === HEADER BANNER ===
      doc.rect(0, 0, pageWidth, 90).fill('#c8102e');
      doc.rect(0, 90, pageWidth, 4).fill('#0f172a');

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, 18, { height: 54 });
      } else {
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff').text('NEXT Z SHOP', margin, 25);
      }

      doc.fillColor('#ffffff').font('Helvetica').fontSize(8.5).text('COMPROBANTE OFICIAL DE ANULACIÓN', margin, 73);

      // Title & Document Code Pill
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff').text('NOTA DE CRÉDITO', 0, 22, { align: 'right', width: pageWidth - margin });
      
      const codeText = creditNote.noteCode || `NC-${creditNote.id}`;
      const codePillWidth = 140;
      const codePillX = pageWidth - margin - codePillWidth;
      doc.roundedRect(codePillX, 48, codePillWidth, 22, 5).fill('#0f172a');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#fbbf24').text(codeText, codePillX, 53, { align: 'center', width: codePillWidth });

      // === SUMMARY CARD INFO ===
      const cardY = 112;
      const cardHeight = 90;
      doc.roundedRect(margin, cardY, contentWidth, cardHeight, 8).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).stroke();

      // Left Column
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('FECHA DE EMISIÓN', margin + 15, cardY + 12);
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(formatDate(creditNote.createdAt), margin + 15, cardY + 24);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('PEDIDO ASOCIADO', margin + 15, cardY + 46);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#c8102e').text(order.orderCode || `#${order.id}`, margin + 15, cardY + 58);

      // Right Column
      const rightColX = margin + (contentWidth / 2) + 10;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('CLIENTE', rightColX, cardY + 12);
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(creditNote.customerEmail, rightColX, cardY + 24, { width: 220 });

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('PROCESADO POR', rightColX, cardY + 46);
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(creditNote.cancelledBy || 'Administración', rightColX, cardY + 58);

      // === REASON BOX ===
      const reasonY = cardY + cardHeight + 12;
      const reasonHeight = 44;
      doc.roundedRect(margin, reasonY, contentWidth, reasonHeight, 6).fill('#fffbeb').strokeColor('#fcd34d').lineWidth(1).stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#92400e').text('MOTIVO DE CANCELACIÓN:', margin + 12, reasonY + 8);
      doc.font('Helvetica').fontSize(9).fillColor('#78350f').text(creditNote.reason || 'Sin motivo especificado', margin + 12, reasonY + 22, { width: contentWidth - 24 });

      // === PRODUCT TABLE ===
      let tableY = reasonY + reasonHeight + 16;
      doc.rect(margin, tableY, contentWidth, 24).fill('#1e293b');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
      doc.text('DESCRIPCIÓN DEL PRODUCTO', margin + 12, tableY + 7, { width: 230 });
      doc.text('CANT.', margin + 250, tableY + 7, { width: 45, align: 'center' });
      doc.text('PRECIO UNIT.', margin + 300, tableY + 7, { width: 90, align: 'right' });
      doc.text('SUBTOTAL', margin + 395, tableY + 7, { width: 105, align: 'right' });

      tableY += 24;

      if (order.items && order.items.length > 0) {
        let isEven = false;
        for (const item of order.items) {
          const name = item.product?.name || 'Producto';
          const rowBg = isEven ? '#ffffff' : '#f8fafc';
          isEven = !isEven;

          doc.rect(margin, tableY, contentWidth, 24).fill(rowBg);
          doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
          doc.text(name, margin + 12, tableY + 7, { width: 230 });
          doc.text(String(item.quantity), margin + 250, tableY + 7, { width: 45, align: 'center' });
          doc.text(formatCLP(Number(item.price)), margin + 300, tableY + 7, { width: 90, align: 'right' });
          doc.font('Helvetica-Bold').text(formatCLP(Number(item.price) * item.quantity), margin + 395, tableY + 7, { width: 105, align: 'right' });

          tableY += 24;
          doc.moveTo(margin, tableY).lineTo(margin + contentWidth, tableY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        }
      }

      // === TOTALES BOX ===
      tableY += 14;
      const totalsBoxWidth = 220;
      const totalsBoxX = margin + contentWidth - totalsBoxWidth;

      if (Number(order.shippingCost) > 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Costo de Envío:', totalsBoxX, tableY, { width: 100, align: 'right' });
        doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(formatCLP(Number(order.shippingCost)), totalsBoxX + 105, tableY, { width: 115, align: 'right' });
        tableY += 18;
      }

      const totalCardHeight = 32;
      doc.roundedRect(totalsBoxX, tableY, totalsBoxWidth, totalCardHeight, 6).fill('#c8102e');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('TOTAL NOTA:', totalsBoxX + 12, tableY + 9);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff').text(formatCLP(Number(creditNote.amount)), totalsBoxX + 100, tableY + 9, { width: 110, align: 'right' });

      // === FOOTER ===
      const footerHeight = 55;
      const footerY = doc.page.height - footerHeight;
      doc.rect(0, footerY, pageWidth, footerHeight).fill('#0f172a');
      doc.rect(0, footerY, pageWidth, 3).fill('#c8102e');

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text('Next Z se pondrá en contacto contigo para coordinar la devolución de tu dinero.', 0, footerY + 14, { align: 'center', width: pageWidth });
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text(`contacto@nextz.cl  •  www.nextz.cl  •  © ${new Date().getFullYear()} Next Z Shop. Todos los derechos reservados.`, 0, footerY + 32, { align: 'center', width: pageWidth });

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
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const logoPath = path.join(process.cwd(), 'uploads', 'logo Next Z.png');
      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      // === HEADER BANNER ===
      doc.rect(0, 0, pageWidth, 90).fill('#c8102e');
      doc.rect(0, 90, pageWidth, 4).fill('#0f172a');

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, 18, { height: 54 });
      } else {
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff').text('NEXT Z SHOP', margin, 25);
      }

      doc.fillColor('#ffffff').font('Helvetica').fontSize(8.5).text('COMPROBANTE OFICIAL DE COMPRA', margin, 73);

      // Title & Document Code Pill
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff').text('ORDEN DE COMPRA', 0, 22, { align: 'right', width: pageWidth - margin });

      const codeText = order.orderCode || `#${order.id}`;
      const codePillWidth = 140;
      const codePillX = pageWidth - margin - codePillWidth;
      doc.roundedRect(codePillX, 48, codePillWidth, 22, 5).fill('#0f172a');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text(codeText, codePillX, 53, { align: 'center', width: codePillWidth });

      // === SUMMARY CARD INFO ===
      const cardY = 112;
      const cardHeight = 90;
      doc.roundedRect(margin, cardY, contentWidth, cardHeight, 8).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).stroke();

      // Left Column
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('FECHA DE EMISIÓN', margin + 15, cardY + 12);
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(formatDate(order.createdAt), margin + 15, cardY + 24);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('CLIENTE', margin + 15, cardY + 46);
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(order.user?.email || order.guestEmail || 'Cliente Registrado', margin + 15, cardY + 58, { width: 210 });

      // Right Column
      const rightColX = margin + (contentWidth / 2) + 10;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('ESTADO DEL PEDIDO', rightColX, cardY + 12);
      
      const statusText = (order.status || 'COMPLETADO').toUpperCase();
      doc.roundedRect(rightColX, cardY + 24, 110, 18, 4).fill('#dcfce7');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#15803d').text(statusText, rightColX, cardY + 28, { align: 'center', width: 110 });

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('DIRECCIÓN DE ENTREGA', rightColX, cardY + 46);
      const addressText = order.shippingAddress ? `${order.shippingAddress}, ${order.commune?.name || ''}` : 'Retiro en Tienda';
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(addressText, rightColX, cardY + 58, { width: 220 });

      // === PRODUCT TABLE ===
      let tableY = cardY + cardHeight + 16;
      doc.rect(margin, tableY, contentWidth, 24).fill('#1e293b');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
      doc.text('DESCRIPCIÓN DEL PRODUCTO', margin + 12, tableY + 7, { width: 230 });
      doc.text('CANT.', margin + 250, tableY + 7, { width: 45, align: 'center' });
      doc.text('PRECIO UNIT.', margin + 300, tableY + 7, { width: 90, align: 'right' });
      doc.text('SUBTOTAL', margin + 395, tableY + 7, { width: 105, align: 'right' });

      tableY += 24;

      if (order.items && order.items.length > 0) {
        let isEven = false;
        for (const item of order.items) {
          const name = item.product?.name || 'Producto';
          const rowBg = isEven ? '#ffffff' : '#f8fafc';
          isEven = !isEven;

          doc.rect(margin, tableY, contentWidth, 24).fill(rowBg);
          doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
          doc.text(name, margin + 12, tableY + 7, { width: 230 });
          doc.text(String(item.quantity), margin + 250, tableY + 7, { width: 45, align: 'center' });
          doc.text(formatCLP(Number(item.price)), margin + 300, tableY + 7, { width: 90, align: 'right' });
          doc.font('Helvetica-Bold').text(formatCLP(Number(item.price) * item.quantity), margin + 395, tableY + 7, { width: 105, align: 'right' });

          tableY += 24;
          doc.moveTo(margin, tableY).lineTo(margin + contentWidth, tableY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        }
      }

      // === TOTALES BOX ===
      tableY += 14;
      const subtotal = order.items ? order.items.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0) : Number(order.total);
      const totalsBoxWidth = 220;
      const totalsBoxX = margin + contentWidth - totalsBoxWidth;

      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Subtotal:', totalsBoxX, tableY, { width: 100, align: 'right' });
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(formatCLP(subtotal), totalsBoxX + 105, tableY, { width: 115, align: 'right' });
      tableY += 18;

      if (Number(order.shippingCost) > 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Costo de Envío:', totalsBoxX, tableY, { width: 100, align: 'right' });
        doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(formatCLP(Number(order.shippingCost)), totalsBoxX + 105, tableY, { width: 115, align: 'right' });
        tableY += 18;
      }

      const totalCardHeight = 32;
      doc.roundedRect(totalsBoxX, tableY, totalsBoxWidth, totalCardHeight, 6).fill('#c8102e');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('TOTAL PAGADO:', totalsBoxX + 12, tableY + 9);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff').text(formatCLP(Number(order.total)), totalsBoxX + 100, tableY + 9, { width: 110, align: 'right' });

      // === FOOTER ===
      const footerHeight = 55;
      const footerY = doc.page.height - footerHeight;
      doc.rect(0, footerY, pageWidth, footerHeight).fill('#0f172a');
      doc.rect(0, footerY, pageWidth, 3).fill('#c8102e');

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#ffffff').text('¡Gracias por tu compra en Next Z Shop!', 0, footerY + 14, { align: 'center', width: pageWidth });
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text(`contacto@nextz.cl  •  www.nextz.cl  •  © ${new Date().getFullYear()} Next Z Shop. Todos los derechos reservados.`, 0, footerY + 32, { align: 'center', width: pageWidth });

      doc.end();
    });
  }
}
