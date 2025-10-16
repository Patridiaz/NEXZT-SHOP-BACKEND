import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Product } from '../products/product.entity';

@Entity()
export class GuestCartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guestId: string; // Usaremos un UUID generado por el frontend

  @ManyToOne(() => Product, { eager: true }) // eager: true carga el producto automáticamente
  product: Product;

  @Column()
  quantity: number;
}