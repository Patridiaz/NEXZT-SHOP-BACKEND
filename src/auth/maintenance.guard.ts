import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private settingsService: SettingsService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isMaintenanceMode = await this.settingsService.getMaintenanceMode();

        // Si no hay modo mantenimiento, todo pasa normal
        if (!isMaintenanceMode) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const url: string = request.url || '';
        const method: string = request.method || '';

        // Rutas que siempre se permiten (autenticación, estado de mantenimiento, webhooks)
        const allowedPaths = [
            '/auth/login',
            '/auth/',
            '/settings/maintenance',
            '/admin/settings/maintenance',
            '/payments/confirm',
            '/payments/return',
        ];
        if (allowedPaths.some((path) => url.startsWith(path))) {
            return true;
        }

        // Verificar si el usuario es admin (el JWT ya fue procesado por JwtAuthGuard)
        const user = request.user;
        if (user?.role === 'admin') {
            return true;
        }

        // Permitir solicitudes GET para que los usuarios puedan navegar el sitio/catálogo
        if (method === 'GET') {
            return true;
        }

        // Bloquear operaciones de escritura/compras durante mantenimiento para usuarios normales
        throw new HttpException(
            {
                statusCode: 503,
                message: 'Sitio en mantenimiento. Las compras están temporalmente deshabilitadas.',
                maintenance: true,
            },
            HttpStatus.SERVICE_UNAVAILABLE,
        );
    }
}
