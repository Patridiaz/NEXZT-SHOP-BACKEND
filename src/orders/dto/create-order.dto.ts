import { IsEmail, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsString, MinLength, IsNumber, Min } from 'class-validator';
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

export class PosItemDto {
  @IsNotEmpty()
  productId: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class CreatePosOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosItemDto)
  items: PosItemDto[];

  @IsNotEmpty()
  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerRut?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsNumber()
  cashReceived?: number;

  @IsOptional()
  @IsNumber()
  changeGiven?: number;
}