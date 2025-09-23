import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Edition } from './edition.entity';
import { CreateEditionDto, UpdateEditionDto } from './dto/edition.dto';

@Injectable()
export class EditionsService {
  constructor(
    @InjectRepository(Edition)
    private readonly editionRepo: Repository<Edition>,
  ) {}

  create(dto: CreateEditionDto): Promise<Edition> {
    const edition = this.editionRepo.create(dto);
    return this.editionRepo.save(edition);
  }

  findAll(): Promise<Edition[]> {
    return this.editionRepo.find();
  }

  async findOne(id: number): Promise<Edition> {
    const edition = await this.editionRepo.findOneBy({ id });
    if (!edition) throw new NotFoundException('Edition not found');
    return edition;
  }

  async update(id: number, dto: UpdateEditionDto): Promise<Edition> {
    const edition = await this.findOne(id);
    Object.assign(edition, dto);
    return this.editionRepo.save(edition);
  }

  async remove(id: number): Promise<void> {
    const edition = await this.findOne(id);
    await this.editionRepo.remove(edition);
  }
}
