import { Controller, Get, Post, Body, Param, Patch, Delete, UseInterceptors, UploadedFile, Query, ParseEnumPipe, DefaultValuePipe, ParseIntPipe, NotFoundException, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Res, BadRequestException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './products.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductCategory } from './enums/product-category.enum';
import { Product } from './product.entity';
import { ProductRarity } from './enums/product-rarity.enum';
import { ExcelService } from 'src/excel/excel.service';
import type { Response } from 'express';
import { GetProductsByIdsDto } from './dto/get-products-by-ids.dto';
import { Public } from 'src/auth/public.decorator';
import { multerOptions } from './multer.config';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly excelService: ExcelService,
  ) {}

@Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  create(
    @UploadedFile() file: Express.Multer.File, // 👈 Inyectar el archivo
    @Body() createProductDto: CreateProductDto // 👈 Inyectar el DTO
  ) {
    // Pasar el archivo al servicio para que guarde la ruta
    return this.productService.create(createProductDto, file);
  }


  @Public()
   @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
    // ✅ Añade el parámetro 'game' para recibir el nombre del juego desde la URL
    @Query('game') game?: string,
    
    // ✅ CORRECCIÓN AQUÍ: Añade { optional: true } al ParseIntPipe
    @Query('brandId', new ParseIntPipe({ optional: true })) brandId?: number,
    @Query('gameId', new ParseIntPipe({ optional: true })) gameId?: number,
    
    @Query('rarity') rarity?: ProductRarity,
  ) {
    return this.productService.findAll({
      page,
      limit,
      search,
      category,
      game,
      brandId,
      gameId,
      rarity,
    });
  }
  @Public()
  @Get('filter-by')
  findByFilter(@Query('game') game?: string, @Query('category') category?: string) {
    return this.productService.findByFilter({ game, category });
  }

  @Public()
  @Get('random')
  findRandom(
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ) {
    return this.productService.findRandom(limit);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number // ✅ 2. Aplica el Pipe aquí
  ): Promise<Product> {
    const product = this.productService.findOne(id);
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

// ✅ MÉTODO DE ACTUALIZACIÓN CORREGIDO
@Patch(':id')
  @UseInterceptors(FileInterceptor('file', multerOptions)) // <-- Usa la misma variable
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File, 
  ) {
    return this.productService.update(id, updateProductDto, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
  
 // --- Endpoints de Carga Masiva ---
  @Get('bulk/template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.excelService.generateProductTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_productos.xlsx');
    res.send(buffer);
  }

  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
  async bulkCreate(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        ],
      }),
    ) file: Express.Multer.File,
  ) {
    return this.productService.bulkCreate(file.buffer);
  }
  
  @Public()
  @Post('by-ids') 
  findByIds(@Body() body: GetProductsByIdsDto): Promise<Product[]> {
    return this.productService.findByIds(body.ids);
  }
}
