import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Order, OrderStatus } from 'src/orders/order.entity';

@Entity()
export class PaymentTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * ✅ ESTA ES LA PARTE QUE FALTA O ESTÁ INCORRECTA
   * Esta relación @ManyToOne le dice a TypeORM que la entidad
   * SÍ ACEPTA un objeto 'order' completo.
   */
  @ManyToOne(() => Order)
  order: Order;

  @Column({
    type: 'enum',
    enum: OrderStatus,
  })
  status: OrderStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ unique: true })
  token: string;

  @CreateDateColumn()
  createdAt: Date;
}