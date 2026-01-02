import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';
import { Region } from '../locations/region.entity';
import { Commune } from '../locations/commune.entity';

export enum OrderStatus {
  PENDING = 'PENDIENTE',
  PAID = 'PAGADO',
  CANCELLED = 'CANCELADO',
}

export enum DeliveryStatus {
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  DISPATCHED = 'DISPATCHED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  // ... (Relaciones de User, GuestEmail, etc. siguen igual)
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user: User | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;
  
  @Column({ type: 'varchar', nullable: true })
  guestEmail: string | null;

  @Column({ nullable: true })
  shippingAddress: string;

  // Relaciones de Ubicación
  @ManyToOne(() => Region, { nullable: true })
  region: Region;

  @ManyToOne(() => Commune, { nullable: true })
  commune: Commune;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  // ✅ NUEVA COLUMNA: Costo de Envío
  @Column('decimal', { precision: 10, scale: 0, default: 0 })
  shippingCost: number;

  // El total incluirá (Suma Productos + Costo Envío)
  @Column('decimal', { precision: 10, scale: 0 })
  total: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ 
    type: 'enum', 
    enum: DeliveryStatus, 
    default: DeliveryStatus.PREPARING 
  })
  deliveryStatus: DeliveryStatus;
}