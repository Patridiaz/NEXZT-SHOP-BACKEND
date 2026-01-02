import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Commune } from './commune.entity';

@Entity()
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Ej: "Metropolitana", "Valparaíso"

  @Column({ nullable: true })
  romanNumber: string; // Ej: "RM", "V", "VIII"

  @OneToMany(() => Commune, (commune) => commune.region)
  communes: Commune[];
}