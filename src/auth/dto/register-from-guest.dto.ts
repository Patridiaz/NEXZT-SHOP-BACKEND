import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterFromGuestDto {
  @IsString()
  @IsNotEmpty()
  paymentToken: string;

  @IsString()      // ✅ Añade la validación de string
  @IsNotEmpty()
  name: string;   // ✅ Añade la propiedad 'name'

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}