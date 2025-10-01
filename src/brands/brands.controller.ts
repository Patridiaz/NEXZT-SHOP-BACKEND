import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { Brand } from './brand.entity';
import { BrandsService } from './brands.service';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandService: BrandsService) {}

  @Post()
  create(@Body() dto: CreateBrandDto): Promise<Brand> {
    return this.brandService.create(dto);
  }
  // ✅ Nuevo endpoint para obtener todas las marcas
  @Get('all')
  findAllSimple() {
    return this.brandService.findAll();
  }
  @Get()
  findAll(): Promise<Brand[]> {
    return this.brandService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number): Promise<Brand> {
    return this.brandService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateBrandDto): Promise<Brand> {
    return this.brandService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number): Promise<void> {
    return this.brandService.remove(id);
  }
}
