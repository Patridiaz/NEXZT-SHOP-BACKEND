import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Order, OrderStatus } from '../orders/order.entity';
import { ProductService } from '../products/products.service';
import { StockAlertsService } from '../products/stock-alerts.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly productService: ProductService,
    private readonly stockAlertsService: StockAlertsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE) // Se ejecuta cada minuto
  async handleExpiredOrders() {
    this.logger.log('Buscando órdenes pendientes expiradas...');

    const expiredOrders = await this.orderRepo.find({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: LessThan(new Date()), // Busca órdenes cuya fecha de expiración ya pasó
      },
      relations: ['items', 'items.product'],
    });

    if (expiredOrders.length === 0) {
      this.logger.log('No se encontraron órdenes expiradas.');
      return;
    }

    for (const order of expiredOrders) {
      this.logger.log(`Cancelando orden #${order.id}`);
      order.status = OrderStatus.CANCELLED;
      await this.orderRepo.save(order);
      
      // Llama a un nuevo método en ProductService para reponer el stock
      await this.productService.replenishStock(order.items);
      this.logger.log(`Stock para la orden #${order.id} repuesto.`);
    }
  }

  // Tarea programada cada hora para verificar productos en stock mínimo o donde stock === límite de compra web
  @Cron(CronExpression.EVERY_HOUR)
  async handlePeriodicStockAlerts() {
    this.logger.log('Ejecutando verificación periódica de alertas de stock...');
    try {
      const result = await this.stockAlertsService.checkAndAlert();
      this.logger.log(
        `Verificación de stock completada. Evaluados: ${result.evaluated}, Alertas de stock mínimo: ${result.lowStockAlerted}, Alertas límite=stock: ${result.limitMatchAlerted}`,
      );
    } catch (err: any) {
      this.logger.error('Error durante la verificación periódica de stock:', err.message);
    }
  }
}