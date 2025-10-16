import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Order } from 'src/orders/order.entity';
import { OrderItem } from 'src/orders/order-item.entity';

@Module({
  imports: [
    // ✅ Le da al módulo acceso a los repositorios de Order y OrderItem
    TypeOrmModule.forFeature([Order, OrderItem]),
  ],
  controllers: [
    // ✅ Registra el controlador para que sus rutas estén activas
    DashboardController,
  ],
  providers: [
    // ✅ Registra el servicio para que pueda ser inyectado en el controlador
    DashboardService,
  ],
})
export class DashboardModule {}