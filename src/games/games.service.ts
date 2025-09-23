import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './game.entity';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
  ) {}

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
    await this.gameRepo.remove(game);
  }
}
