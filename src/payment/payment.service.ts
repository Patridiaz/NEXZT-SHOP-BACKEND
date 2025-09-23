import { Injectable, HttpException, Logger, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order, OrderStatus } from 'src/orders/order.entity';
import { PaymentTransaction } from './PaymentTransaction.entity';
import * as crypto from 'crypto'; // Importa crypto de esta manera
import { OrderItem } from 'src/orders/order-item.entity';
import { Product } from 'src/products/product.entity';
import { ProductService } from 'src/products/products.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private baseUrl = process.env.FLOW_BASE_URL!;
  private apiKey = process.env.FLOW_API_KEY!;
  private secretKey = process.env.FLOW_SECRET_KEY!;
  private confirmUrl = process.env.FLOW_CONFIRM_URL!;

  constructor(
    @InjectRepository(PaymentTransaction)
    private transactionRepo: Repository<PaymentTransaction>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    private readonly productService: ProductService,
  ) {}

  private buildSignature(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort();
    const stringToSign = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    return crypto.createHmac('sha256', this.secretKey).update(stringToSign).digest('hex');
  }

  // Crear pago (este método está bien)
 // 🚀 Crear pago
  async createPayment(orderId: number) {
    this.logger.log(`Iniciando creación de pago para la orden ID: ${orderId}`);
    
    // 1. Busca la orden y carga la relación con el usuario para obtener su email
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['user'],
    });
    if (!order) {
      throw new HttpException(`Orden con ID ${orderId} no encontrada`, HttpStatus.NOT_FOUND);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new HttpException(`La orden ${orderId} ya no está pendiente de pago.`, HttpStatus.BAD_REQUEST);
    }

    // 2. Prepara los datos para la API de Flow
    const amount = Math.round(Number(order.total));
    const commerceOrder = `order-${order.id}-${Date.now()}`; // ID único para Flow

    const params = {
      apiKey: this.apiKey,
      commerceOrder,
      subject: `Pago por orden #${order.id}`,
      amount: String(amount),
      email: order.user.email,
      urlConfirmation: this.confirmUrl,
      urlReturn: process.env.FLOW_BACKEND_RETURN_URL!,
    };

    // 3. Genera la firma
    const signature = this.buildSignature(params);
    const payload = { ...params, s: signature };
    
    this.logger.debug('Enviando payload a Flow:', payload);

    try {
      // 4. Llama a la API de Flow para crear el pago
      const body = new URLSearchParams(payload).toString();
      const { data } = await axios.post(
        `${this.baseUrl}/payment/create`,
        body,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      if (!data.token || !data.url) {
        throw new Error('La respuesta de Flow no fue válida.');
      }

      // 5. Guarda la transacción pendiente en tu base de datos
      const transaction = this.transactionRepo.create({
        order,
        status: OrderStatus.PENDING,
        amount,
        token: data.token,
      });
      await this.transactionRepo.save(transaction);
      this.logger.log(`Transacción creada con token: ${data.token}`);

      // 6. Devuelve la URL de pago al frontend
      return { paymentUrl: `${data.url}?token=${data.token}`, token: data.token };

    } catch (err: any) {
      this.logger.error('Error en createPayment al contactar a Flow:', err.response?.data || err.message);
      throw new HttpException('Error al crear el pago en Flow', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ CONFIRMACIÓN FLOW (CORREGIDA)
async confirmPayment(body: { token: string }) {
    this.logger.log(`--- Iniciando Confirmación de Pago para el token: ${body.token} ---`);
    const { token } = body;
    if (!token) { /* ... */ }

    try {
      const paymentData = await this.getPaymentDetails(token);
      const matches = paymentData.commerceOrder?.match(/^order-(\d+)-/);
      if (!matches || !matches[1]) { /* ... */ }
      const orderId = parseInt(matches[1], 10);

      // ✅ 3. Carga la orden CON sus items y productos
      const order = await this.orderRepo.findOne({ 
        where: { id: orderId },
        relations: ['items', 'items.product'] 
      });
      if (!order) { /* ... */ }
      
      // ✅ AÑADE ESTE BLOQUE DE VERIFICACIÓN AQUÍ
      if (!order) {
        this.logger.error(`Error de confirmación: Orden con ID ${orderId} no fue encontrada.`);
        // Lanzamos una excepción para detener el proceso de forma segura.
        // El try/catch exterior la manejará y responderá OK a Flow.
        throw new HttpException(`Orden con ID ${orderId} no encontrada`, HttpStatus.NOT_FOUND);
      }

      // Evitar procesar una orden que ya fue pagada
      if (order.status === OrderStatus.PAID ) {
        this.logger.log(`La orden ${orderId} ya fue procesada previamente.`);
        return { message: 'OK, already-processed' };
      }

      let newStatus: OrderStatus = order.status;
      if (paymentData.status === 1 || paymentData.status === 2) {
        newStatus = OrderStatus.PAID;
      } else if (paymentData.status === 3 || paymentData.status === 4) {
        newStatus = OrderStatus.FAILED;
      }
      
      this.logger.log(`Nuevo estado para la orden ${orderId}: ${newStatus}`);

      // ✅ 4. Si la orden se pagó, DESCUENTA EL STOCK
      if (newStatus === OrderStatus.PAID) {
        await this.productService.deductStock(order.items);
        this.logger.log(`Stock para la orden ${orderId} descontado exitosamente.`);
      }
      
      // 5. Actualiza tu base de datos (después de descontar el stock)
      order.status = newStatus;
      await this.orderRepo.save(order);
      await this.transactionRepo.update({ token }, { status: newStatus });

      this.logger.log(`--- Confirmación para orden ${orderId} finalizada exitosamente ---`);
      return { message: 'OK' };
    } catch (err) {
      // ...
    }
  }
  
  // ✅ CONSULTAR ESTADO (este método está bien y es clave para la seguridad)
  async getPaymentDetails(token: string) {
    const params = { apiKey: this.apiKey, token };
    const signature = this.buildSignature(params);
    
    // El método GET de Axios para application/x-www-form-urlencoded
    const url = new URL(`${this.baseUrl}/payment/getStatus`);
    url.searchParams.append('apiKey', params.apiKey);
    url.searchParams.append('token', params.token);
    url.searchParams.append('s', signature);
    
    try {
      const { data } = await axios.get(url.toString());
      if (data.code && data.code !== 0) {
        throw new Error(data.message);
      }
      return data;
    } catch (err: any) {
      this.logger.error('Error en getPaymentDetails:', err.response?.data || err.message);
      throw new HttpException('Error al consultar estado de pago en Flow', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }



}