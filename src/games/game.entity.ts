import { Edition } from 'src/editions/edition.entity';
import { Product } from 'src/products/product.entity';
import { Subdivision } from 'src/subdivisions/subdivision.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable } from 'typeorm';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @OneToMany(() => Product, (product) => product.game)
  products: Product[];

  @OneToMany(() => Edition, (edition) => edition.game)
  editions: Edition[];

  @ManyToMany(() => Subdivision, (subdivision) => subdivision.games)
  @JoinTable({
    name: 'game_subdivisions',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'subdivision_id', referencedColumnName: 'id' },
  })
  subdivisions: Subdivision[];

  @Column({ default: true })
  showInNavbar: boolean;

  @Column({ default: 0 })
  order: number;
}
