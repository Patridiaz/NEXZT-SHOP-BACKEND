import { IsString, IsNotEmpty, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsBoolean()
  // ✅ LÓGICA DE TRANSFORMACIÓN CORREGIDA Y SIMPLIFICADA
  @Transform(({ value }) => value === 'true')
  isFeatured?: boolean;
}