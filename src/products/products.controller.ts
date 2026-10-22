import { Controller, Get, Post, Body, Param, Patch, Delete, UseInterceptors, UploadedFile, Query, ParseEnumPipe, DefaultValuePipe, ParseIntPipe, NotFoundException, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, FileValidator, Res, BadRequestException, UseGuards, ForbiddenException, Req } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';

export class ExcelFileValidator extends FileValidator {
  isValid(file?: Express.Multer.File): boolean {
    if (!file) return false;
    const isValidExt = /\.(xlsx|xls)$/i.test(file.originalname);
    const isValidMime = /(sheet|excel|xlsx|xls|octet-stream|zip)/i.test(file.mimetype);
    return isValidExt || isValidMime;
  }

  buildErrorMessage(): string {
    return 'El archivo debe ser un documento Excel válido (.xlsx o .xls).';
  }
}
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './products.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductCategory } from './enums/product-category.enum';
import { Product } from './product.entity';
import { ExcelService } from 'src/excel/excel.service';
import type { Response } from 'express';
import { GetProductsByIdsDto } from './dto/get-products-by-ids.dto';
import { Public } from 'src/auth/public.decorator';
import { multerOptions } from './multer.config';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/users/user.entity';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly excelService: ExcelService,
  ) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createProductDto: CreateProductDto
  ) {
    return this.productService.create(createProductDto, file);
  }


  @Public()
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('game') game?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('brandId', new ParseIntPipe({ optional: true })) brandId?: number,
    @Query('gameId', new ParseIntPipe({ optional: true })) gameId?: number,
    @Query('editionId', new ParseIntPipe({ optional: true })) editionId?: number,
    @Query('rarityId', new ParseIntPipe({ optional: true })) rarityId?: number,
    @Query('subdivisionId', new ParseIntPipe({ optional: true })) subdivisionId?: number,
    @Query('code') code?: string,
    @Query('name') name?: string,
    @Query('showHidden') showHidden?: string,
  ) {
    return this.productService.findAll({
      page,
      limit,
      search,
      category,
      game,
      brandId,
      gameId,
      editionId,
      rarityId,
      subdivisionId,
      sort,
      order,
      code,
      name,
      showHidden: showHidden === 'true',
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
  @Get('barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string): Promise<Product> {
    return this.productService.findByBarcode(barcode);
  }

  // --- Endpoints de Carga Masiva y Alertas ---
  @Post('alerts/check')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async checkStockAlerts() {
    return this.productService.checkStockAlerts();
  }

  @Get('bulk/template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.excelService.generateProductTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_productos.xlsx');
    res.send(buffer);
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

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: any,
  ) {
    return this.productService.update(id, updateProductDto, file, req?.user?.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }

  @Post('bulk/preview')
  @UseInterceptors(FileInterceptor('file'))
  async bulkPreview(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new ExcelFileValidator({}),
        ],
      }),
    ) file: Express.Multer.File,
  ) {
    return this.productService.bulkPreview(file.buffer);
  }

  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
  async bulkCreate(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new ExcelFileValidator({}),
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
