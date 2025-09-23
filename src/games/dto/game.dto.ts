import { IsNotEmpty } from 'class-validator';

export class CreateGameDto {
  @IsNotEmpty()
  name: string;
}

export class UpdateGameDto {
  @IsNotEmpty()
  name: string;
}
