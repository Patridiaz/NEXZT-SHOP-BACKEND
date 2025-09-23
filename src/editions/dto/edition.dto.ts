import { IsNotEmpty } from 'class-validator';

export class CreateEditionDto {
  @IsNotEmpty()
  name: string;
}

export class UpdateEditionDto {
  @IsNotEmpty()
  name: string;
}
