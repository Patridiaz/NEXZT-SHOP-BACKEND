import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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
        const url: string = request.url || '';

        // Siempre permitir el login y los webhooks de pago (son críticos)
        const allowedPaths = ['/auth/login', '/payments/confirm', '/payments/return'];
        if (allowedPaths.some(path => url.startsWith(path))) {
            return true;
        }

        // Verificar si el usuario es admin (el JWT ya fue procesado por JwtAuthGuard)
        const user = request.user;
        if (user?.role === 'admin') {
            return true;
        }

        // Bloquear a todos los demás (incluidas rutas @Public)
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
