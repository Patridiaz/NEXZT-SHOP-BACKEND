import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from 'src/auth/public.decorator';

@Controller('checkout')
export class CheckoutController {
    private readonly logger = new Logger(CheckoutController.name);

    @Public()
    @Get('success')
    async handleSuccess(@Query('token') token: string, @Res() res: Response) {
        this.logger.log(`Usuario aterrizó en /checkout/success con token: ${token}`);

        // Si por alguna razón FRONTEND_SUCCESS_URL no está definido, usamos un default razonable
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://nextz.nextz.cl';
        const frontendSuccessUrl = `${frontendBaseUrl}/checkout/success?token=${token}`;

        this.logger.log(`Redirigiendo a frontend: ${frontendSuccessUrl}`);
        return res.redirect(frontendSuccessUrl);
    }

    @Public()
    @Get('cancel')
    async handleCancel(@Query('token') token: string, @Res() res: Response) {
        this.logger.log(`Usuario aterrizó en /checkout/cancel con token: ${token}`);

        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://nextz.nextz.cl';
        const frontendCancelUrl = `${frontendBaseUrl}/checkout/cancel?token=${token}`;

        this.logger.log(`Redirigiendo a frontend (cancelado): ${frontendCancelUrl}`);
        return res.redirect(frontendCancelUrl);
    }
}
