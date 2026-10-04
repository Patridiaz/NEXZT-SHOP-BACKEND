import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { KardexMovementType } from '../enums/kardex-movement-type.enum';

export class CreateKardexMovementDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsEnum(KardexMovementType)
  @IsNotEmpty()
  movementType: KardexMovementType;

  @IsInt()
  @IsNotEmpty()
  quantity: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  userId?: number;
}
