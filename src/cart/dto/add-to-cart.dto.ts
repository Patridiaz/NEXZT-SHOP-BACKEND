import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddToCartDto {
  @IsNotEmpty()
  @IsNumber()
  productId: number;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  guestCartId?: string;
}