import { Brand } from 'src/brands/brand.entity';
import { Edition } from 'src/editions/edition.entity';
import { Game } from 'src/games/game.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductCategory } from './enums/product-category.enum';
import { Rarity } from 'src/rarities/rarity.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  // ✅ NUEVO CAMPO DE CATEGORÍA
  @Column({
    type: 'enum',
    enum: ProductCategory,
  })
  category: ProductCategory;

  // ✅ NUEVO CAMPO PARA LA URL DE LA IMAGEN
  @Column({ type: 'varchar', nullable: true })
  imageUrl: string;


  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  offerPrice: number;

  @Column('int')
  stock: number;

  @ManyToOne(() => Brand, (brand) => brand.products, { nullable: false })
  @JoinColumn({ name: 'brandId' })
  brand: Brand;


  @ManyToOne(() => Game, (game) => game.products, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'game_id' })
  game: Game | null;

  @ManyToOne(() => Edition, (edition) => edition.products, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'edition_id' })
  edition: Edition | null;

  @ManyToOne(() => Rarity, (rarity) => rarity.products, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rarity_id' })
  rarity: Rarity | null;

  @Column({ type: 'int', nullable: true })
  purchaseLimit: number | null;

  @Column({ type: 'boolean', default: true })
  isVisible: boolean;
}
