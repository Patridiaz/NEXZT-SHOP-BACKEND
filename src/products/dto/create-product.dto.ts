import { Transform } from 'class-transformer'; // 👈 Import Transform
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsInt,
  Min
} from 'class-validator';
import { ProductCategory } from '../enums/product-category.enum';
import { ProductRarity } from '../enums/product-rarity.enum';

export class CreateProductDto {
  @IsString() // TypeORM/PostgreSQL handle varchar length, focus on validation
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProductCategory)
  @IsNotEmpty()
  category: ProductCategory;

  @Transform(({ value }) => parseFloat(value)) // Convert string to float
  @IsNumber({ maxDecimalPlaces: 2 }) // Ensure correct decimal format
  @IsPositive()
  price: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0) // Offer price can be 0
  offerPrice?: number; // Renamed from discountPrice

  @Transform(({ value }) => parseInt(value, 10)) // Convert string to integer
  @IsInt() // Validate as integer
  @Min(0) // Stock can be 0
  stock: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  brandId: number;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined) // Handle optional conversion
  @IsInt()
  @IsPositive()
  editionId?: number;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsInt()
  @IsPositive()
  gameId?: number;

  @IsOptional()
  @IsEnum(ProductRarity)
  rarity?: ProductRarity;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  purchaseLimit?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isVisible?: boolean;
}
