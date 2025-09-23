import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ProductCategory } from '../enums/product-category.enum';

export class CreateProductDto {
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string; // obligatorio y único

  @IsNotEmpty()
  description: string;

  // ✅ AGREGAR VALIDACIÓN PARA LA CATEGORÍA
  @IsEnum(ProductCategory)
  @IsNotEmpty()
  category: ProductCategory;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  discountPrice?: number;

  @IsNumber()
  @IsPositive()
  stock: number;

  @IsNumber()
  @IsPositive()
  brandId: number; // ✅ ahora es obligatorio

  @IsOptional()
  @IsNumber()
  @IsPositive()
  editionId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  gameId?: number;
}
