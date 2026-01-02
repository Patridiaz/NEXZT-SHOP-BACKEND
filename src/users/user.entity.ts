/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Asumo que el nombre sí lo pides al registrarse. Si no, agrégale { nullable: true }

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  // ✅ NUEVOS CAMPOS (Opcionales para el registro)
  @Column({ type: 'varchar',nullable: true })
  rut: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  address: string;

  // ✅ Campoo adicional útil para el checkout (opcional)
  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  commune: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;
}