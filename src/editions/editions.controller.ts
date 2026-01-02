import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { CreateEditionDto, UpdateEditionDto } from './dto/edition.dto';
import { Edition } from './edition.entity';
import { EditionsService } from './editions.service';

@Controller('editions')
export class EditionsController {
  constructor(private readonly editionService: EditionsService) { }

  @Post()
  create(@Body() dto: CreateEditionDto): Promise<Edition> {
    return this.editionService.create(dto);
  }

  @Get()
  findAll(): Promise<Edition[]> {
    return this.editionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Edition> {
    return this.editionService.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEditionDto): Promise<Edition> {
    return this.editionService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.editionService.remove(id);
  }
}
