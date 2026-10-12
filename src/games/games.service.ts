import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Game } from './game.entity';
import { Product } from 'src/products/product.entity';
import { Edition } from 'src/editions/edition.entity';
import { Subdivision } from 'src/subdivisions/subdivision.entity';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Edition)
    private readonly editionRepo: Repository<Edition>,
    @InjectRepository(Subdivision)
    private readonly subdivisionRepo: Repository<Subdivision>,
  ) {}

  async create(dto: CreateGameDto): Promise<Game> {
    const { subdivisionIds, ...gameData } = dto;
    const game = this.gameRepo.create(gameData);

    if (subdivisionIds && subdivisionIds.length > 0) {
      game.subdivisions = await this.subdivisionRepo.findBy({ id: In(subdivisionIds) });
    } else {
      game.subdivisions = [];
    }

    return this.gameRepo.save(game);
  }

  findAll(): Promise<Game[]> {
    return this.gameRepo.find({
      relations: ['subdivisions'],
      order: {
        order: 'ASC',
        name: 'ASC',
      },
    });
  }

  async findOne(id: number): Promise<Game> {
    const game = await this.gameRepo.findOne({
      where: { id },
      relations: ['subdivisions'],
    });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  async update(id: number, dto: UpdateGameDto): Promise<Game> {
    const game = await this.findOne(id);
    const { subdivisionIds, ...gameData } = dto;
    Object.assign(game, gameData);

    if (subdivisionIds !== undefined) {
      if (subdivisionIds.length > 0) {
        game.subdivisions = await this.subdivisionRepo.findBy({ id: In(subdivisionIds) });
      } else {
        game.subdivisions = [];
      }
    }

    return this.gameRepo.save(game);
  }

  async remove(id: number): Promise<void> {
    const game = await this.findOne(id);

    // Limpiamos referencias manualmente por si synchronize no actualizó las FKs
    await this.productRepo.update({ game: { id } }, { game: null });
    await this.editionRepo.update({ gameId: id }, { gameId: null });

    await this.gameRepo.remove(game);
  }

  findForNavbar(): Promise<Game[]> {
    return this.gameRepo.find({
      where: {
        showInNavbar: true,
      },
      relations: ['subdivisions'],
      order: {
        order: 'ASC',
      },
    });
  }
}
