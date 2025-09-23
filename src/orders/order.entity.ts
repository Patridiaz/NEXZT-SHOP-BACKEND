import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';
import { PaymentTransaction } from 'src/payment/PaymentTransaction.entity';

// ✅ 1. Define y exporta el enum con los posibles estados de una orden.
export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}
@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

@OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items: OrderItem[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;
  
  @OneToMany(() => PaymentTransaction, transaction => transaction.order)
  transactions: PaymentTransaction[];

  // ✅ Nuevo campo para la fecha de expiración
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
}
