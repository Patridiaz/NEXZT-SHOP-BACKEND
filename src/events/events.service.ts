import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  async create(dto: CreateEventDto, file: Express.Multer.File): Promise<Event> {
    const event = this.eventRepo.create({
      ...dto,
      imageUrl: `/uploads/${file.filename}`,
    });
    return this.eventRepo.save(event);
  }

  findAll(): Promise<Event[]> {
    return this.eventRepo.find({ order: { date: 'DESC' } });
  }

  async findOne(id: number): Promise<Event> {
    const event = await this.eventRepo.findOneBy({ id });
    if (!event) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }
    return event;
  }

  async update(id: number, dto: UpdateEventDto, file?: Express.Multer.File): Promise<Event> {
    const event = await this.eventRepo.preload({ id, ...dto });
    if (!event) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }

    if (file) {
      // Opcional: eliminar la imagen antigua antes de asignar la nueva
      if (event.imageUrl) {
        try {
          await unlink(join(process.cwd(), event.imageUrl));
        } catch (error) {
          console.error('Error eliminando imagen antigua:', error);
        }
      }
      event.imageUrl = `/uploads/${file.filename}`;
    }

    return this.eventRepo.save(event);
  }

  async remove(id: number): Promise<void> {
    const event = await this.findOne(id);
    if (event.imageUrl) {
        try {
          await unlink(join(process.cwd(), event.imageUrl));
        } catch (error) {
          console.error('Error eliminando imagen:', error);
        }
    }
    await this.eventRepo.remove(event);
  }
}