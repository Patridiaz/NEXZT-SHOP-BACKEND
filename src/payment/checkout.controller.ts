// checkout.controller.ts
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

    // ✅ SOLUCIÓN: En lugar de redirigir, mostramos el HTML de éxito directamente.
    // Esto evita el bucle infinito.
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pago Exitoso | Nextz</title>
          <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
              .icon { color: #2ecc71; font-size: 60px; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
              p { color: #666; line-height: 1.5; margin-bottom: 30px; }
              .btn { background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; transition: background 0.3s; }
              .btn:hover { background-color: #0056b3; }
          </style>
      </head>
      <body>
          <div class="card">
              <div class="icon">✓</div>
              <h1>¡Pago Realizado!</h1>
              <p>Tu compra se ha procesado correctamente. Hemos enviado los detalles a tu correo.</p>
              <a href="https://nextz.nextz.cl" class="btn">Volver a la Tienda</a>
          </div>
      </body>
      </html>
    `;

    return res.status(200).send(htmlContent);
  }

  @Public()
  @Get('cancel')
  async handleCancel(@Res() res: Response) {
      // Pantalla simple de cancelación
      return res.status(200).send(`
          <div style="text-align:center; padding:50px; font-family:sans-serif;">
              <h1 style="color: #e74c3c;">Pago Cancelado</h1>
              <p>Has cancelado el proceso de pago.</p>
              <a href="https://nextz.nextz.cl">Volver a intentar</a>
          </div>
      `);
  }
}