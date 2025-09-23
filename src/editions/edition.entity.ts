import { Game } from 'src/games/game.entity';
import { Product } from 'src/products/product.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

@Entity('editions')
export class Edition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Game, (game) => game.editions)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @OneToMany(() => Product, (product) => product.edition)
  products: Product[];
}
