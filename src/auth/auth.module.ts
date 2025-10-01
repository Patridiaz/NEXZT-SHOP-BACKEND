import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PaymentModule } from 'src/payment/payment.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { Order } from 'src/orders/order.entity';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    PaymentModule,
    TypeOrmModule.forFeature([User, Order]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRATION') },
      }),
    }),
  ],
  controllers: [AuthController], // ← importante
  providers: [AuthService, JwtStrategy,JwtAuthGuard],
  exports: [AuthService,JwtAuthGuard],
})
export class AuthModule {}
