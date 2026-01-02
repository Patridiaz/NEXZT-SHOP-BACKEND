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
    this.logger.log(`✅ PAGO EXITOSO - Mostrando pantalla final. Token: ${token}`);

    // 🛑 IMPORTANTE: AQUÍ ELIMINAMOS LA REDIRECCIÓN (res.redirect)
    // En su lugar, enviamos el HTML directamente al navegador.
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pago Exitoso | Nextz</title>
          <style>
              body { font-family: 'Segoe UI', sans-serif; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 50px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
              .circle { background: #2ecc71; color: white; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 0 auto 20px; }
              h1 { color: #333; margin: 0 0 10px; font-size: 26px; }
              p { color: #666; margin-bottom: 30px; line-height: 1.5; }
              .token { font-family: monospace; background: #eee; padding: 5px 10px; border-radius: 4px; font-size: 12px; color: #555; }
              .btn { background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; transition: transform 0.2s; }
              .btn:hover { transform: scale(1.05); background-color: #2980b9; }
          </style>
      </head>
      <body>
          <div class="card">
              <div class="circle">✓</div>
              <h1>¡Pago Aceptado!</h1>
              <p>Tu compra en <strong>Nextz</strong> ha sido procesada correctamente.</p>
              <p class="token">ID Transacción: ${token}</p>
              <br/>
              <a href="https://nextz.nextz.cl" class="btn">Volver a la Tienda</a>
          </div>
      </body>
      </html>
    `;

    // Respondemos con código 200 y el HTML
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