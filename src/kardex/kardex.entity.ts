import { Product } from 'src/products/product.entity';
import { User } from 'src/users/user.entity';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { KardexMovementType } from './enums/kardex-movement-type.enum';

@Entity('kardex')
export class Kardex {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    type: 'enum',
    enum: KardexMovementType,
  })
  movementType: KardexMovementType;

  @Column('int')
  quantity: number;

  @Column('int')
  previousStock: number;

  @Column('int')
  newStock: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalValue: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  reference: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
