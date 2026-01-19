import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Edition } from './edition.entity';
import { Product } from 'src/products/product.entity';
import { Game } from 'src/games/game.entity';
import { CreateEditionDto, UpdateEditionDto } from './dto/edition.dto';

@Injectable()
export class EditionsService {
  constructor(
    @InjectRepository(Edition)
    private readonly editionRepo: Repository<Edition>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
  ) { }

  async create(dto: CreateEditionDto): Promise<Edition> {
    const { gameId, ...data } = dto;
    const edition = this.editionRepo.create(data);

    if (gameId) {
      edition.game = await this.gameRepo.findOneBy({ id: gameId });
    }

    return this.editionRepo.save(edition);
  }

  findAll(): Promise<Edition[]> {
    return this.editionRepo.find({ relations: ['game'] });
  }

  async findOne(id: number): Promise<Edition> {
    const edition = await this.editionRepo.findOne({
      where: { id },
      relations: ['game']
    });
    if (!edition) throw new NotFoundException('Edition not found');
    return edition;
  }

  async update(id: number, dto: UpdateEditionDto): Promise<Edition> {
    const { gameId, ...data } = dto;
    const edition = await this.findOne(id);

    // Actualizar campos básicos
    Object.assign(edition, data);

    // Actualizar relación explícitamente
    if (gameId !== undefined) {
      edition.game = gameId ? await this.gameRepo.findOneBy({ id: gameId }) : null;
    }

    await this.editionRepo.save(edition);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const edition = await this.findOne(id);

    // Limpiamos referencias en productos manualmente por si synchronize no actualizó las FKs
    await this.productRepo.update({ edition: { id } }, { edition: null });

    await this.editionRepo.remove(edition);
  }
}
