import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'PENDIENTE',
  PAID = 'PAGADO',
  SHIPPED = 'ENVIADO',
  DELIVERED = 'ENTREGADO',
  CANCELLED = 'CANCELADO',
}

// ✅ NUEVO: Estado Logístico
export enum DeliveryStatus {
  PREPARING = 'PREPARING',             // Inicial / En preparación
  READY_FOR_PICKUP = 'READY_FOR_PICKUP', // Listo para retiro en tienda
  DISPATCHED = 'DISPATCHED',           // Despachado (entregado al courier)
  SHIPPED = 'SHIPPED',                 // Enviado / En tránsito
  DELIVERED = 'DELIVERED',             // Entregado al cliente
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user: User | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;
  
  // ✅ CORRECCIÓN: Se cambia el tipo a 'string | null'
  @Column({  type: 'varchar', nullable: true })
  guestEmail: string | null;

  @Column({ nullable: true })
  shippingAddress: string ;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  expiresAt: Date;

  @Column({ 
    type: 'enum', 
    enum: DeliveryStatus, 
    default: DeliveryStatus.PREPARING 
  })
  deliveryStatus: DeliveryStatus;
}