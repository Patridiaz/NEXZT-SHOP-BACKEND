// En src/auth/jwt-auth.guard.ts

import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Siempre intentamos parsear el JWT para poblar request.user
    // (necesario para que MaintenanceGuard identifique al admin en rutas públicas)
    return super.canActivate(context);
  }

  // Si la ruta es pública y el token falla/no existe, NO rechazamos — request.user queda null
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // En rutas públicas: si hay error de auth, lo ignoramos (usuario anónimo)
      return user || null;
    }

    // En rutas protegidas: comportamiento normal (lanza excepción si no hay token)
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }

    return user;
  }
}