import { Game } from 'src/games/game.entity';
import { Product } from 'src/products/product.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

@Entity('editions')
export class Edition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'game_id', nullable: true })
  gameId: number | null;

  @ManyToOne(() => Game, (game) => game.editions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'game_id' })
  game: Game | null;

  @OneToMany(() => Product, (product) => product.edition)
  products: Product[];
}
