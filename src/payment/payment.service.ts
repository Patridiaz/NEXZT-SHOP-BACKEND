import { Injectable, HttpException, Logger, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from 'src/orders/order.entity';
import { PaymentTransaction } from './PaymentTransaction.entity';
import * as crypto from 'crypto';
import { ProductService } from 'src/products/products.service';
import { MailService } from 'src/mail/mail.service';

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
    private readonly mailService: MailService,
  ) { }

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

    // Flow requiere el email del pagador — usamos el del cliente o fallback del .env
    const customerEmail = order.user?.email || order.guestEmail || process.env.MAIL_USER;
    params.email = customerEmail!;
    this.logger.log(`Email usado para Flow: ${customerEmail}`);

    const signature = this.buildSignature(params);
    const body = new URLSearchParams({ ...params, s: signature }).toString();

    // Validación previa: detectar exactamente qué param falta o es undefined
    const missingParams = Object.entries(params)
      .filter(([, v]) => !v || v === 'undefined')
      .map(([k]) => k);

    if (missingParams.length > 0) {
      this.logger.error(`Params faltantes o undefined antes de enviar a Flow: ${missingParams.join(', ')}`);
      throw new HttpException(
        { message: `Parámetros de pago faltantes: ${missingParams.join(', ')}`, missingParams },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`Todos los params OK. Enviando a Flow (${this.baseUrl})`);

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
      const flowError = err.response?.data;
      this.logger.error('Error en createPayment - respuesta completa de Flow:', JSON.stringify(flowError));
      this.logger.error(`URL: ${this.baseUrl}/payment/create | apiKey: ${this.apiKey?.slice(0, 8)}... | amount: ${amount} | email: ${params.email}`);
      throw new HttpException(
        {
          message: flowError?.message || err.message || 'Error al crear el pago en Flow',
          flowCode: flowError?.code,
          detail: flowError,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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

      if (newStatus === OrderStatus.PAID) {
        const userEmail = order.user?.email || order.guestEmail;
        const userName = order.user?.name || 'Cliente';
        if (userEmail) {
          this.mailService.sendOrderPaidEmail(userEmail, userName, order.orderCode, order.total).catch(() => { });
        }
      }

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

  async getTransactionByToken(token: string) {
    return this.transactionRepo.findOne({
      where: { token },
      relations: ['order', 'order.items', 'order.items.product'],
    });
  }
}