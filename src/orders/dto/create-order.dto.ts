import { IsEmail, IsNotEmpty, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class GuestCartItemDto {
  @IsNotEmpty()
  productId: number;

  @IsNotEmpty()
  quantity: number;
}

export class CreateOrderDto {
  // Datos para invitados
  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @IsOptional()
  @IsNotEmpty()
  shippingAddress?: string;

  // El carrito del invitado se envía directamente en el DTO
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestCartItemDto)
  guestCart?: GuestCartItemDto[];
}