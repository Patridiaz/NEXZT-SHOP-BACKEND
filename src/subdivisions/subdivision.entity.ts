import { Game } from 'src/games/game.entity';
import { Product } from 'src/products/product.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('subdivisions')
export class Subdivision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @ManyToMany(() => Game, (game) => game.subdivisions)
  games: Game[];

  @OneToMany(() => Product, (product) => product.subdivision)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
