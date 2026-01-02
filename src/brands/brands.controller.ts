import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { Brand } from './brand.entity';
import { BrandsService } from './brands.service';
import { Public } from 'src/auth/public.decorator';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandService: BrandsService) { }

  @Post()
  create(@Body() dto: CreateBrandDto): Promise<Brand> {
    return this.brandService.create(dto);
  }
  @Public()
  @Get('all')
  findAllSimple() {
    return this.brandService.findAll();
  }
  @Get()
  findAll(): Promise<Brand[]> {
    return this.brandService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Brand> {
    return this.brandService.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto): Promise<Brand> {
    return this.brandService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.brandService.remove(id);
  }
}
