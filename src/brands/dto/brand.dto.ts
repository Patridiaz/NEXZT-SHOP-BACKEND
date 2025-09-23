import { IsNotEmpty } from 'class-validator';

export class CreateBrandDto {
  @IsNotEmpty()
  name: string;
}

export class UpdateBrandDto {
  @IsNotEmpty()
  name: string;
}
