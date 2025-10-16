import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from 'src/orders/order.entity';
import { Repository } from 'typeorm';
import { OrderItem } from 'src/orders/order-item.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
  ) {}

  // 1. Datos para el gráfico de ventas por día (últimos 30 días)
  async getSalesOverTime() {
    return this.orderRepo
      .createQueryBuilder('order')
      .select("DATE(order.createdAt) as date")
      .addSelect("SUM(order.total)", "sales")
      .where("order.status = :status", { status: OrderStatus.PAID })
      .andWhere("order.createdAt > DATE_SUB(NOW(), INTERVAL 30 DAY)")
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();
  }

  // 2. Datos para el listado de productos más vendidos
  async getTopSellingProducts(limit = 5) {
    return this.orderItemRepo
      .createQueryBuilder('order_item')
      .select('product.name', 'name')
      .addSelect('SUM(order_item.quantity)', 'totalSold')
      .innerJoin('order_item.product', 'product')
      .innerJoin('order_item.order', 'order')
      .where('order.status = :status', { status: OrderStatus.PAID })
      .groupBy('product.id')
      .orderBy('totalSold', 'DESC')
      .limit(limit)
      .getRawMany();
  }
  
  // 3. Resumen general (KPIs)
  async getSummary() {
    const totalSalesResult = await this.orderRepo.createQueryBuilder('order')
      .select('SUM(order.total)', 'totalRevenue')
      .where('order.status = :status', { status: OrderStatus.PAID })
      .getRawOne();

    const totalOrders = await this.orderRepo.count({ where: { status: OrderStatus.PAID } });

    return {
      totalRevenue: totalSalesResult.totalRevenue || 0,
      totalOrders,
    };
  }
}