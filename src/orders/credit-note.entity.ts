import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('credit_notes')
export class CreditNote {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true, nullable: true })
    noteCode: string;

    @ManyToOne(() => Order, { eager: true })
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column('decimal', { precision: 10, scale: 0 })
    amount: number;

    @Column({ type: 'text' })
    reason: string;

    @Column({ type: 'varchar' })
    customerEmail: string;

    @Column({ type: 'varchar', nullable: true })
    customerPhone: string;

    @Column({ type: 'varchar' })
    cancelledBy: string; // nombre o email del admin que canceló

    @CreateDateColumn()
    createdAt: Date;
}
