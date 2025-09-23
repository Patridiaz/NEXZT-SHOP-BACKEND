// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express'; // 👈 Importar
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule); // 👈 Usar NestExpressApplication

  // ✅ Configurar el servidor de archivos estáticos
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/', // El prefijo de la URL para acceder a los archivos
  });

  // Habilitar CORS si tu frontend está en otro dominio
  app.enableCors();

  await app.listen(3000);
}
bootstrap();