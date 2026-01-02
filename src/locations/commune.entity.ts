import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Region } from './region.entity';

@Entity()
export class Commune {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Ej: "Providencia", "Puente Alto"

  // ✅ Columna clave para tu lógica de despacho
  @Column({ type: 'decimal', precision: 10, scale: 0, nullable: true })
  fixedShippingCost: number | null; // Si es NULL, se usa tarifa Starken por pagar. Si tiene valor, es tarifa fija.

  // ✅ Otra columna útil: ¿Hacemos despachos aquí?
  @Column({ default: true })
  isDispatchAvailable: boolean;

  @ManyToOne(() => Region, (region) => region.communes, { onDelete: 'CASCADE' })
  region: Region;
}