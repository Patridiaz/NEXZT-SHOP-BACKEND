import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Order } from '../orders/order.entity';
import { OrderStatus } from '../orders/order-status.enum';

@Entity({ name: 'payment_transactions' })
export class PaymentTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, order => order.transactions)
  order: Order;

  @Column()
  token: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  // ✅ El estado de la transacción puede ser diferente al de la orden
  @Column({
    type: 'enum',
    enum: OrderStatus, // Reutilizamos el enum de OrderStatus
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;
}