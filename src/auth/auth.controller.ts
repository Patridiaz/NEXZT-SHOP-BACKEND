/* eslint-disable prettier/prettier */
import { Controller, Post, Body, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from '../users/dto/login.dto';
import { Roles } from './roles.decorator';
import { UserRole } from 'src/users/user.entity';
import { RolesGuard } from './roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterFromGuestDto } from './dto/register-from-guest.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
  ) {}

    @Public()
    @Post('register')
    async register(@Body() dto: CreateUserDto) {
      // ✅ CORRECCIÓN 2: Toda la lógica se delega al servicio.
      return this.authService.register(dto);
    }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.authService.login(user as any);
  }


  // @Public()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @Post('create-admin')
  // createAdmin(@Body() dto: CreateUserDto) {
  //   return this.usersService.create(dto.name, dto.email, dto.password, UserRole.ADMIN);
  // }



  @Public()
  @Post('register-from-guest')
  registerFromGuest(@Body() dto: RegisterFromGuestDto) {
    return this.authService.registerFromGuest(dto);
  }
  
}
