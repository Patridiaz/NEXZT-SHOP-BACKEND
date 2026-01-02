import { IsEmail, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class GuestCartItemDto {
  @IsNotEmpty()
  productId: number;

  @IsNotEmpty()
  quantity: number;
}

export class CreateOrderDto {
  // Datos básicos
  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @IsOptional()
  @IsNotEmpty()
  shippingAddress?: string;

  // Ubicación
  @IsOptional()
  @IsString()
  regionName?: string;

  @IsOptional()
  @IsString()
  communeName?: string;

  // ✅ NUEVOS CAMPOS: Para crear cuenta durante el checkout
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Carrito
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestCartItemDto)
  guestCart?: GuestCartItemDto[];
}