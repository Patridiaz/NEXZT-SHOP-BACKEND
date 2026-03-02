import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rarity } from './rarity.entity';
import { CreateRarityDto, UpdateRarityDto } from './dto/rarity.dto';

@Injectable()
export class RaritiesService {
    constructor(
        @InjectRepository(Rarity)
        private readonly rarityRepo: Repository<Rarity>,
    ) { }

    async create(dto: CreateRarityDto): Promise<Rarity> {
        const exists = await this.rarityRepo.findOne({ where: { name: dto.name } });
        if (exists) {
            throw new ConflictException(`La rareza '${dto.name}' ya existe.`);
        }
        const rarity = this.rarityRepo.create(dto);
        return this.rarityRepo.save(rarity);
    }

    async findAll(): Promise<Rarity[]> {
        return this.rarityRepo.find({ order: { name: 'ASC' } });
    }

    async findOne(id: number): Promise<Rarity> {
        const rarity = await this.rarityRepo.findOne({ where: { id } });
        if (!rarity) {
            throw new NotFoundException(`Rareza con ID ${id} no encontrada`);
        }
        return rarity;
    }

    async update(id: number, dto: UpdateRarityDto): Promise<Rarity> {
        const rarity = await this.findOne(id);
        if (dto.name && dto.name !== rarity.name) {
            const exists = await this.rarityRepo.findOne({ where: { name: dto.name } });
            if (exists) {
                throw new ConflictException(`La rareza '${dto.name}' ya existe.`);
            }
        }
        Object.assign(rarity, dto);
        return this.rarityRepo.save(rarity);
    }

    async remove(id: number): Promise<void> {
        const rarity = await this.findOne(id);
        await this.rarityRepo.remove(rarity);
    }
}
