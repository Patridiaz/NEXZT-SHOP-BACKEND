import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class CarouselItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    imageUrl: string;

    @Column({ nullable: true })
    title: string;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    link: string;

    @Column({ default: 0 })
    order: number;

    @Column({ default: true })
    isActive: boolean;
}
