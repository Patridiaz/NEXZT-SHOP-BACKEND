import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class MaintenanceGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

        // Si no hay modo mantenimiento, todo pasa normal
        if (!isMaintenanceMode) {
            return true;
        }

        const request = context.switchToHttp().getRequest();

        // Siempre permitir el login para que los admins puedan entrar
        if (request.url?.startsWith('/auth/login')) {
            return true;
        }

        // Permitir rutas marcadas como @Public() (ej: webhooks de Flow)
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        // Verificar si el usuario es admin (el JWT ya fue procesado por JwtAuthGuard)
        const user = request.user;
        if (user?.role === 'admin') {
            return true;
        }

        // Bloquear a todos los demás
        throw new HttpException(
            {
                statusCode: 503,
                message: 'Sitio en mantenimiento. Vuelve pronto.',
                maintenance: true,
            },
            HttpStatus.SERVICE_UNAVAILABLE,
        );
    }
}
