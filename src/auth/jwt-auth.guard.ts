// En src/auth/jwt-auth.guard.ts

import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core'; // ✅ 1. Importa Reflector
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator'; // ✅ 2. Importa la clave

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  
  // ✅ 3. Inyecta Reflector en el constructor
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // ✅ 4. Revisa si la ruta tiene la metadata 'isPublic'
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si es pública, permite el acceso sin verificar el token
    if (isPublic) {
      return true;
    }

    // Si no es pública, procede con la validación normal del token JWT
    return super.canActivate(context);
  }
}