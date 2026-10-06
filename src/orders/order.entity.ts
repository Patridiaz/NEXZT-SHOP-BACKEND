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

export enum OrderChannel {
  WEB = 'WEB',
  POS = 'POS',
}

export enum PaymentMethod {
  WEBPAY = 'WEBPAY',
  EFECTIVO = 'EFECTIVO',
  DEBITO = 'DEBITO',
  CREDITO = 'CREDITO',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true, nullable: true })
  orderCode: string;

  // ... (Relaciones de User, GuestEmail, etc. siguen igual)
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user: User | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', nullable: true })
  guestEmail: string | null;

  // Canal de venta (WEB o POS)
  @Column({ type: 'varchar', default: 'WEB' })
  channel: string;

  // Método de Pago (WEBPAY, EFECTIVO, DEBITO, CREDITO, TRANSFERENCIA)
  @Column({ type: 'varchar', default: 'WEBPAY' })
  paymentMethod: string;

  // Datos del Cliente POS
  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerRut: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  // Vendedor / Cajero que atendió en POS
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  seller: User | null;

  @Column({ type: 'int', nullable: true })
  sellerId: number | null;

  // Detalles de Vuelto / Efectivo recibidos en POS
  @Column('decimal', { precision: 10, scale: 0, default: 0 })
  cashReceived: number;

  @Column('decimal', { precision: 10, scale: 0, default: 0 })
  changeGiven: number;

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