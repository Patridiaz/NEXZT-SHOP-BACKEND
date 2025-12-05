import { Edition } from 'src/editions/edition.entity';
import { Product } from 'src/products/product.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';


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

  @Column({ default: false })
  showInNavbar: boolean;
}
