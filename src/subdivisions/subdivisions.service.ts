import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subdivision } from './subdivision.entity';
import { CreateSubdivisionDto, UpdateSubdivisionDto } from './dto/subdivision.dto';
import { Game } from 'src/games/game.entity';
import { Product } from 'src/products/product.entity';
import { ProductCategory } from 'src/products/enums/product-category.enum';

@Injectable()
export class SubdivisionsService implements OnModuleInit {
  constructor(
    @InjectRepository(Subdivision)
    private readonly subdivisionRepo: Repository<Subdivision>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.subdivisionRepo.count();
      if (count === 0) {
        console.log('[Subdivisions] Inicializando subdivisiones por defecto: Productos Sellados y Singles (Cartas)...');
        
        let sellados = await this.subdivisionRepo.save(
          this.subdivisionRepo.create({ name: 'Productos Sellados', order: 1, description: 'Cajas, sobres, blisters y productos sellados' })
        );
        let singles = await this.subdivisionRepo.save(
          this.subdivisionRepo.create({ name: 'Singles (Cartas)', order: 2, description: 'Cartas sueltas y coleccionables' })
        );

        // Asociar a todos los juegos existentes
        const games = await this.gameRepo.find({ relations: ['subdivisions'] });
        for (const game of games) {
          game.subdivisions = [sellados, singles];
          await this.gameRepo.save(game);
        }

        // Asociar a productos existentes si tenían category sellado o carta
        await this.productRepo.createQueryBuilder()
          .update(Product)
          .set({ subdivision: sellados })
          .where('category = :cat AND subdivision_id IS NULL', { cat: ProductCategory.SELLADO })
          .execute();

        await this.productRepo.createQueryBuilder()
          .update(Product)
          .set({ subdivision: singles })
          .where('category = :cat AND subdivision_id IS NULL', { cat: ProductCategory.CARTA })
          .execute();

        console.log('[Subdivisions] Inicialización completada exitosamente.');
      }
    } catch (error) {
      console.warn('[Subdivisions] Error durante la inicialización de subdivisiones:', error?.message);
    }
  }

  async create(dto: CreateSubdivisionDto): Promise<Subdivision> {
    const exists = await this.subdivisionRepo.findOne({ where: { name: dto.name.trim() } });
    if (exists) {
      throw new ConflictException(`La subdivisión '${dto.name}' ya existe.`);
    }
    const subdivision = this.subdivisionRepo.create({
      ...dto,
      name: dto.name.trim(),
    });
    return this.subdivisionRepo.save(subdivision);
  }

  async findAll(): Promise<Subdivision[]> {
    return this.subdivisionRepo.find({
      order: { order: 'ASC', name: 'ASC' },
      relations: ['games'],
    });
  }

  async findOne(id: number): Promise<Subdivision> {
    const subdivision = await this.subdivisionRepo.findOne({
      where: { id },
      relations: ['games'],
    });
    if (!subdivision) {
      throw new NotFoundException(`Subdivisión con ID ${id} no encontrada`);
    }
    return subdivision;
  }

  async findByGameId(gameId: number): Promise<Subdivision[]> {
    return this.subdivisionRepo.createQueryBuilder('subdivision')
      .innerJoin('subdivision.games', 'game', 'game.id = :gameId', { gameId })
      .orderBy('subdivision.order', 'ASC')
      .addOrderBy('subdivision.name', 'ASC')
      .getMany();
  }

  async update(id: number, dto: UpdateSubdivisionDto): Promise<Subdivision> {
    const subdivision = await this.findOne(id);
    if (dto.name && dto.name.trim() !== subdivision.name) {
      const exists = await this.subdivisionRepo.findOne({ where: { name: dto.name.trim() } });
      if (exists) {
        throw new ConflictException(`La subdivisión '${dto.name}' ya existe.`);
      }
    }
    Object.assign(subdivision, {
      ...dto,
      name: dto.name ? dto.name.trim() : subdivision.name,
    });
    return this.subdivisionRepo.save(subdivision);
  }

  async remove(id: number): Promise<void> {
    const subdivision = await this.findOne(id);
    await this.subdivisionRepo.remove(subdivision);
  }
}
