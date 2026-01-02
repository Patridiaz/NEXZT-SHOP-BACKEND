import { IsString, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  password?: string;

  // ✅ Aquí permitimos actualizar los nuevos campos
  @IsString()
  @IsOptional()
  rut?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;
  
  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  commune?: string;
}