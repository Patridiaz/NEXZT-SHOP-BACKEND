import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateEditionDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  gameId: number;
}

export class UpdateEditionDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  gameId?: number;
}
