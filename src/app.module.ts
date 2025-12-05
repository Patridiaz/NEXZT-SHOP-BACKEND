/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentModule } from './payment/payment.module';
import { BrandsModule } from './brands/brands.module';
import { GamesModule } from './games/games.module';
import { EditionsModule } from './editions/editions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsModule } from './events/events.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DashboardModule } from './admin/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // ✅ 1. Cambia el tipo de base de datos
        type: 'postgres',

        // ✅ 2. Lee la URL completa desde una sola variable de entorno
        url: config.get<string>('DATABASE_URL'),

        // ✅ 3. Añade este bloque para la conexión segura (requerido por Render)
        ssl: process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,

        autoLoadEntities: true,
        synchronize: true, // Ideal para desarrollo, considera migraciones para producción
      }),
    }),
    UsersModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentModule,
    BrandsModule,
    GamesModule,
    EditionsModule,
    ScheduleModule.forRoot(),
    EventsModule,
    DashboardModule
  ],
    providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}