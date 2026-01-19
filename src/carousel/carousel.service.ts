import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarouselItem } from './carousel-item.entity';
import { CreateCarouselDto } from './dto/create-carousel.dto';
import { UpdateCarouselDto } from './dto/update-carousel.dto';

@Injectable()
export class CarouselService {
    constructor(
        @InjectRepository(CarouselItem)
        private readonly carouselRepo: Repository<CarouselItem>,
    ) { }

    async findAll(): Promise<CarouselItem[]> {
        return this.carouselRepo.find({
            order: { order: 'ASC', id: 'DESC' },
        });
    }

    async findActive(): Promise<CarouselItem[]> {
        return this.carouselRepo.find({
            where: { isActive: true },
            order: { order: 'ASC', id: 'DESC' },
            take: 6, // ✅ Limitar a 6 imágenes para el carrusel del home
        });
    }

    async findOne(id: number): Promise<CarouselItem> {
        const item = await this.carouselRepo.findOne({ where: { id } });
        if (!item) {
            throw new NotFoundException(`Carousel item with ID ${id} not found`);
        }
        return item;
    }

    async create(dto: CreateCarouselDto, file?: Express.Multer.File): Promise<CarouselItem> {
        const newItem = this.carouselRepo.create(dto);
        if (file) {
            newItem.imageUrl = `/uploads/${file.filename}`;
        }
        return this.carouselRepo.save(newItem);
    }

    async update(id: number, dto: UpdateCarouselDto, file?: Express.Multer.File): Promise<CarouselItem> {
        const item = await this.findOne(id);
        Object.assign(item, dto);
        if (file) {
            item.imageUrl = `/uploads/${file.filename}`;
        }
        return this.carouselRepo.save(item);
    }

    async remove(id: number): Promise<void> {
        const item = await this.findOne(id);
        await this.carouselRepo.remove(item);
    }
}
