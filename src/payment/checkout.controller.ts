import { Controller, Get, Query, Res, Logger, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { Public } from 'src/auth/public.decorator';

@Controller('checkout')
export class CheckoutController {
    private readonly logger = new Logger(CheckoutController.name);

    @Public()
    @Get('success')
    async handleSuccess(@Query('token') token: string, @Res() res: Response, @Req() req: Request) {
        this.logger.log(`Usuario aterrizó en /checkout/success con token: ${token}`);

        // Prioridad: FRONTEND_SUCCESS_URL > FRONTEND_URL
        const frontendSuccessUrlEnv = process.env.FRONTEND_SUCCESS_URL;
        const frontendUrlEnv = process.env.FRONTEND_URL;

        let targetUrl: string;

        if (frontendSuccessUrlEnv) {
            targetUrl = frontendSuccessUrlEnv;
        } else if (frontendUrlEnv) {
            targetUrl = `${frontendUrlEnv}/checkout/success`;
        } else {
            targetUrl = 'https://nextz.nextz.cl/checkout/success';
        }

        // Limpiar URL de posibles caracteres extraños al final si el .env está corrupto
        targetUrl = targetUrl.split(' ')[0].trim();

        // Añadir el token de forma segura
        const urlObj = new URL(targetUrl);
        urlObj.searchParams.set('token', token);
        const finalUrl = urlObj.toString();

        this.logger.log(`Redirigiendo a: ${finalUrl}`);

        // PROTECCIÓN ESTRICTA CONTRA BUCLES
        const currentHost = req.get('host');
        const targetHost = urlObj.host;

        if (currentHost === targetHost) {
            this.logger.error(`BUCLE DETECTADO: El host de destino (${targetHost}) es igual al host actual (${currentHost}).`);
            return res.status(200).send(`
                <html>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>Pago Procesado con Éxito</h1>
                        <p>El pago se ha completado correctamente.</p>
                        <p>Por favor, regrese a la pestaña de la tienda o <a href="https://nextz.nextz.cl">haga clic aquí para volver</a>.</p>
                    </body>
                </html>
            `);
        }

        return res.redirect(finalUrl);
    }

    @Public()
    @Get('cancel')
    async handleCancel(@Query('token') token: string, @Res() res: Response) {
        this.logger.log(`Usuario aterrizó en /checkout/cancel con token: ${token}`);

        let targetBase = process.env.FRONTEND_URL || 'https://nextz.nextz.cl';
        targetBase = targetBase.split(' ')[0].trim();

        const urlObj = new URL(targetBase.endsWith('/') ? `${targetBase}checkout/cancel` : `${targetBase}/checkout/cancel`);
        urlObj.searchParams.set('token', token);

        const finalUrl = urlObj.toString();

        this.logger.log(`Redirigiendo a (cancelado): ${finalUrl}`);
        return res.redirect(finalUrl);
    }
}
