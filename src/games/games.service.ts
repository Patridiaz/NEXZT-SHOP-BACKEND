import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './game.entity';
import { Product } from 'src/products/product.entity';
import { Edition } from 'src/editions/edition.entity';
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
  ) { }

  create(dto: CreateGameDto): Promise<Game> {
    const game = this.gameRepo.create(dto);
    return this.gameRepo.save(game);
  }

  findAll(): Promise<Game[]> {
    return this.gameRepo.find();
  }

  async findOne(id: number): Promise<Game> {
    const game = await this.gameRepo.findOneBy({ id });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  async update(id: number, dto: UpdateGameDto): Promise<Game> {
    const game = await this.findOne(id);
    Object.assign(game, dto);
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
        showInNavbar: true
      },
      order: {
        order: 'ASC'
      }
    });
  }

}
