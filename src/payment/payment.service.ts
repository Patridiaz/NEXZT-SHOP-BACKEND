import { Injectable, HttpException, Logger, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from 'src/orders/order.entity';
import { PaymentTransaction } from './PaymentTransaction.entity';
import * as crypto from 'crypto';
import { ProductService } from 'src/products/products.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private baseUrl = process.env.FLOW_BASE_URL!;
  private apiKey = process.env.FLOW_API_KEY!;
  private secretKey = process.env.FLOW_SECRET_KEY!;
  private confirmUrl = process.env.FLOW_CONFIRM_URL!;

  constructor(
    @InjectRepository(PaymentTransaction) private transactionRepo: Repository<PaymentTransaction>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private readonly productService: ProductService,
  ) {}
  
private buildSignature(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const stringToSign = sortedKeys.map(key => `${key}=${params[key]}`).join('&');


  return crypto.createHmac('sha256', this.secretKey).update(stringToSign).digest('hex');
}

async createPayment(orderId: number) {
    this.logger.log(`Iniciando creación de pago para la orden ID: ${orderId}`);
    
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['user'] });
    if (!order) {
      throw new HttpException(`Orden con ID ${orderId} no encontrada`, HttpStatus.NOT_FOUND);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new HttpException(`La orden ${orderId} ya no está pendiente de pago.`, HttpStatus.BAD_REQUEST);
    }

    const amount = Math.round(Number(order.total));
    const commerceOrder = `order-${order.id}-${Date.now()}`;

    // ✅ CONSTRUIMOS EL PAYLOAD BASE SIN EL EMAIL
    const params: Record<string, string> = {
      apiKey: this.apiKey,
      commerceOrder,
      subject: `Pago por orden #${order.id}`,
      amount: String(amount),
      urlConfirmation: this.confirmUrl,
      urlReturn: process.env.FLOW_RETURN_URL!,
    };
    
    // ✅ OBTENEMOS EL EMAIL REAL (SI EXISTE)
    const customerEmail = order.user?.email || order.guestEmail;

    // ✅ AÑADIMOS EL EMAIL A LOS PARÁMETROS SOLO SI ES VÁLIDO
    // Para el sandbox de Flow, es más seguro seguir usando 'cliente@flow.cl'
    // para evitar cualquier error de validación por su parte.
    params.email = 'pdiaz290@gmail.com';

    /*
    // LÓGICA PARA CUANDO PASES A PRODUCCIÓN:
    // Comenta la línea de arriba y descomenta esta.
    if (customerEmail) {
      params.email = customerEmail;
    }
    */

    const signature = this.buildSignature(params);
    const body = new URLSearchParams({ ...params, s: signature }).toString();
    
    try {
      const { data } = await axios.post(`${this.baseUrl}/payment/create`, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      if (!data.token || !data.url) {
        throw new Error('La respuesta de Flow no fue válida.');
      }

      const transaction = this.transactionRepo.create({
        order,
        status: OrderStatus.PENDING,
        amount,
        token: data.token,
      });
      await this.transactionRepo.save(transaction);
      this.logger.log(`Transacción creada con token: ${data.token}`);

      return { paymentUrl: `${data.url}?token=${data.token}`, token: data.token };

    } catch (err: any) {
      this.logger.error('Error en createPayment:', err.response?.data || err.message);
      throw new HttpException('Error al crear el pago en Flow', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
 
  async confirmPayment(body: { token: string }) {
    this.logger.log(`--- Iniciando Confirmación de Pago para el token: ${body.token} ---`);
    const { token } = body;
    if (!token) { return { message: 'OK, no-token' }; }

    try {
      const paymentData = await this.getPaymentDetails(token);
      const matches = paymentData.commerceOrder?.match(/^order-(\d+)-/);
      if (!matches || !matches[1]) {
        throw new Error(`commerceOrder inválido: ${paymentData.commerceOrder}`);
      }
      const orderId = parseInt(matches[1], 10);
      const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items', 'items.product'] });
      
      if (!order) throw new HttpException(`Orden con ID ${orderId} no encontrada`, HttpStatus.NOT_FOUND);
      if (order.status === OrderStatus.PAID) { 
        this.logger.log(`La orden ${orderId} ya fue procesada.`);
        return { message: 'OK, already-processed' };
      }

      let newStatus: OrderStatus;
      if (paymentData.status === 2) { // 2 = pagada
        newStatus = OrderStatus.PAID;
      } else { // 3 = rechazada, 4 = anulada
        newStatus = OrderStatus.CANCELLED;
      }
      
      this.logger.log(`Nuevo estado para la orden ${orderId}: ${newStatus}`);

      if (newStatus === OrderStatus.PAID && order.status === OrderStatus.PENDING) {
          
          // ✅ 1. AÑADE ESTA LÍNEA: Descontamos el stock SÓLO si el pago es exitoso.
          await this.productService.deductStock(order.items); 
          this.logger.log(`Orden ${orderId} pagada. Stock descontado.`);

        } else if (newStatus === OrderStatus.CANCELLED && order.status === OrderStatus.PENDING) {
          
          // ✅ 2. BORRA ESTA LÍNEA: Ya no reponemos stock, porque nunca se descontó.
          // await this.productService.replenishStock(order.items); 
          this.logger.log(`Pago fallido/anulado. No se hace nada con el stock.`);
        }
      
      order.status = newStatus;
      await this.orderRepo.save(order);
      await this.transactionRepo.update({ token }, { status: newStatus });

      this.logger.log(`--- Confirmación para orden ${orderId} finalizada ---`);
      return { message: 'OK' };
    } catch (err) {
      this.logger.error(`Error crítico en confirmPayment para token ${token}:`, err);
      // Se lanza el error para que el catch exterior lo maneje.
      throw err;
    }
  }
 
  async getPaymentDetails(token: string) {
    const params = { apiKey: this.apiKey, token };
    const signature = this.buildSignature(params);
    
    const url = new URL(`${this.baseUrl}/payment/getStatus`);
    url.searchParams.append('apiKey', params.apiKey);
    url.searchParams.append('token', params.token);
    url.searchParams.append('s', signature);
    
    try {
      const { data } = await axios.get(url.toString());
      return data;
    } catch (err: any) {
      this.logger.error('Error en getPaymentDetails:', err.response?.data || err.message);
      throw new HttpException('Error al consultar estado de pago en Flow', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}