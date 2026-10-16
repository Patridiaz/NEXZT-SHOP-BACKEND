import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Product } from './product.entity';
import { MailService, StockAlertProductItem } from '../mail/mail.service';

interface AlertSentRecord {
  lastStock: number;
  lastSentAt: number;
}

@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  // Registro en memoria para evitar spam de correos repetidos por el mismo stock (re-alerta cada 12 hrs si persiste)
  private minStockAlertHistory = new Map<number, AlertSentRecord>();
  private limitMatchAlertHistory = new Map<number, AlertSentRecord>();

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Obtiene la dirección de correo configurada para recibir alertas.
   * Por defecto: pdiaz290@gmail.com
   */
  private getTargetEmail(): string {
    return (
      this.configService.get<string>('STOCK_ALERT_EMAIL') ||
      'pdiaz290@gmail.com'
    );
  }

  /**
   * Evalúa y envía alertas para un grupo de productos por ID (o todos si no se especifican IDs).
   */
  async checkAndAlert(productIds?: number[]): Promise<{
    evaluated: number;
    lowStockAlerted: number;
    limitMatchAlerted: number;
  }> {
    const targetEmail = this.getTargetEmail();
    const now = Date.now();
    const DEDUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 horas

    let products: Product[] = [];
    if (productIds && productIds.length > 0) {
      const uniqueIds = Array.from(new Set(productIds));
      products = await this.productRepo.find({
        where: { id: In(uniqueIds) },
        relations: ['brand'],
      });
    } else {
      products = await this.productRepo.find({
        relations: ['brand'],
      });
    }

    const lowStockToSend: StockAlertProductItem[] = [];
    const limitMatchToSend: StockAlertProductItem[] = [];

    for (const product of products) {
      const stock = Number(product.stock ?? 0);
      const minStock =
        product.minStock !== null && product.minStock !== undefined
          ? Number(product.minStock)
          : 5;
      const purchaseLimit =
        product.purchaseLimit !== null && product.purchaseLimit !== undefined
          ? Number(product.purchaseLimit)
          : null;

      // 1. EVALUAR ALERTA DE STOCK MÍNIMO (stock <= minStock)
      if (stock <= minStock) {
        const lastRecord = this.minStockAlertHistory.get(product.id);
        const shouldSend =
          !lastRecord ||
          lastRecord.lastStock !== stock ||
          now - lastRecord.lastSentAt > DEDUPLICATE_WINDOW_MS;

        if (shouldSend) {
          lowStockToSend.push({
            id: product.id,
            code: product.code,
            name: product.name,
            stock,
            minStock,
            price: Number(product.price || 0),
            brandName: product.brand?.name,
          });
          this.minStockAlertHistory.set(product.id, {
            lastStock: stock,
            lastSentAt: now,
          });
        }
      } else {
        // Si el stock ya es saludable (> minStock), limpiar el historial para re-alertar en futura baja
        this.minStockAlertHistory.delete(product.id);
      }

      // 2. EVALUAR ALERTA DE LÍMITE DE COMPRA WEB IGUAL A STOCK (purchaseLimit > 0 && stock === purchaseLimit)
      if (purchaseLimit !== null && purchaseLimit > 0 && stock === purchaseLimit) {
        const lastRecord = this.limitMatchAlertHistory.get(product.id);
        const shouldSend =
          !lastRecord ||
          lastRecord.lastStock !== stock ||
          now - lastRecord.lastSentAt > DEDUPLICATE_WINDOW_MS;

        if (shouldSend) {
          limitMatchToSend.push({
            id: product.id,
            code: product.code,
            name: product.name,
            stock,
            purchaseLimit,
            price: Number(product.price || 0),
            brandName: product.brand?.name,
          });
          this.limitMatchAlertHistory.set(product.id, {
            lastStock: stock,
            lastSentAt: now,
          });
        }
      } else if (purchaseLimit === null || stock !== purchaseLimit) {
        // Si la condición ya no se cumple, limpiar para permitir alertar cuando vuelva a coincidir
        this.limitMatchAlertHistory.delete(product.id);
      }
    }

    // ENVIAR CORREO 1: Stock Mínimo
    if (lowStockToSend.length > 0) {
      try {
        await this.mailService.sendLowStockAlertEmail(targetEmail, lowStockToSend);
        this.logger.log(
          `Alerta de Stock Mínimo enviada a ${targetEmail} (${lowStockToSend.length} productos).`,
        );
      } catch (err: any) {
        this.logger.error(
          `Error al enviar correo de alerta de stock mínimo a ${targetEmail}: ${err.message}`,
          err.stack,
        );
      }
    }

    // ENVIAR CORREO 2: Límite de compra web igual a stock disponible
    if (limitMatchToSend.length > 0) {
      try {
        await this.mailService.sendPurchaseLimitStockMatchEmail(
          targetEmail,
          limitMatchToSend,
        );
        this.logger.log(
          `Alerta de Límite de Compra igual a Stock enviada a ${targetEmail} (${limitMatchToSend.length} productos).`,
        );
      } catch (err: any) {
        this.logger.error(
          `Error al enviar correo de alerta de límite de compra a ${targetEmail}: ${err.message}`,
          err.stack,
        );
      }
    }

    return {
      evaluated: products.length,
      lowStockAlerted: lowStockToSend.length,
      limitMatchAlerted: limitMatchToSend.length,
    };
  }

  /**
   * Limpia el registro de alertas enviadas (útil para pruebas o reseteo administrativo)
   */
  clearHistory(): void {
    this.minStockAlertHistory.clear();
    this.limitMatchAlertHistory.clear();
    this.logger.log('Historial de alertas de stock reseteado.');
  }
}
