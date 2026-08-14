/* eslint-disable prettier/prettier */
import { Controller, Post, Body, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from '../users/dto/login.dto';
import { RegisterFromGuestDto } from './dto/register-from-guest.dto';
import { Public } from './public.decorator';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/recovery.dto';
import { SettingsService } from '../settings/settings.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
  ) { }

  @Public()
  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    if (await this.settingsService.getMaintenanceMode()) {
      throw new HttpException(
        {
          statusCode: 503,
          message: 'El sitio está en modo mantenimiento. El registro de usuarios está deshabilitado temporalmente.',
          maintenance: true,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // ✅ Si el sitio está en mantenimiento, bloquear el login si el usuario no es admin
    if ((await this.settingsService.getMaintenanceMode()) && user.role !== 'admin') {
      throw new HttpException(
        {
          statusCode: 503,
          message: 'El sitio está en modo mantenimiento. Solo los administradores pueden iniciar sesión en este momento.',
          maintenance: true,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return this.authService.login(user as any);
  }

  @Public()
  @Post('register-from-guest')
  async registerFromGuest(@Body() dto: RegisterFromGuestDto) {
    if (await this.settingsService.getMaintenanceMode()) {
      throw new HttpException(
        {
          statusCode: 503,
          message: 'El sitio está en modo mantenimiento.',
          maintenance: true,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.authService.registerFromGuest(dto);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
