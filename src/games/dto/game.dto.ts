import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGameDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  // ✅ CORRECCIÓN:
  // 1. @IsOptional(): Si no lo envías, la base de datos usará el 'default: false'
  // 2. @IsBoolean(): Valida que sea true/false y no un string
  @IsOptional()
  @IsBoolean()
  showInNavbar?: boolean;
}

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  // ✅ CORRECCIÓN:
  // Igual aquí, quitamos IsNotEmpty porque ya es opcional
  @IsOptional()
  @IsBoolean()
  showInNavbar?: boolean;
}