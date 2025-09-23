import { Controller, Get, Post, Body, Param, Patch, Delete, UseInterceptors, UploadedFile, Query, ParseEnumPipe, DefaultValuePipe, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './products.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductCategory } from './enums/product-category.enum';
import { Product } from './product.entity';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

@Post()
  @UseInterceptors(FileInterceptor('file', { // 👈 'file' debe coincidir con el nombre del campo en el frontend
    storage: diskStorage({
      destination: './uploads', // Directorio donde se guardarán las imágenes
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  create(
    @UploadedFile() file: Express.Multer.File, // 👈 Inyectar el archivo
    @Body() createProductDto: CreateProductDto // 👈 Inyectar el DTO
  ) {
    // Pasar el archivo al servicio para que guarde la ruta
    return this.productService.create(createProductDto, file);
  }

  @Get()
  findAll(
    // ✅ Parámetros de paginación con valores por defecto
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    // ✅ Parámetro de búsqueda
    @Query('search') search?: string,
    // ... (otros filtros)
  ) {
    return this.productService.findAll({ page, limit, search, /* otros filtros */ });
  }

  @Get('filter-by')
  findByFilter(
    @Query('game') game?: string,
    @Query('category') category?: string,
  ) {
    return this.productService.findByFilter({ game, category });
  }
  
   // ✅ NUEVO ENDPOINT
  @Get('random')
  findRandom(
    // El 'limit' viene de la URL, ej: /products/random?limit=3
    // DefaultValuePipe pone 3 si no se especifica el límite.
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ) {
    return this.productService.findRandom(limit);
  }

  
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
  @UseInterceptors(FileInterceptor('file')) // 1. Añade el interceptor para leer el archivo
  update(
    @Param('id', ParseIntPipe) id: number, // 2. Parsea el ID a número
    @Body() updateProductDto: UpdateProductDto, // 3. Recibe los datos del formulario
    @UploadedFile() file?: Express.Multer.File, // 4. Recibe el archivo (es opcional)
  ) {
    // 5. Llama al servicio con todos los datos
    return this.productService.update(id, updateProductDto, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
}
