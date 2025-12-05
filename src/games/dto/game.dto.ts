import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGameDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  showInNavbar: boolean;
}

export class UpdateGameDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name: string;

  @IsNotEmpty()
  @IsOptional()
  showInNavbar: boolean;
}
