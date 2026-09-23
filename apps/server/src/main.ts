import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';
import { SocketIoAdapter } from './realtime/socket-io.adapter';

async function bootstrap() {
  try {
    process.loadEnvFile(); // apps/server/.env for local development
  } catch {
    // No .env file: rely on the real environment (e.g. Render).
  }
  const config = loadConfig();
  const app = await NestFactory.create(AppModule.forRoot(config));

  app.enableCors({ origin: config.corsOrigins });
  app.useWebSocketAdapter(new SocketIoAdapter(app, config.corsOrigins));
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  Logger.log(
    `Listening on :${config.port} · real feed ${config.footballDataToken ? 'enabled' : 'disabled'} · ` +
      `MongoDB ${config.mongoUri ? 'enabled' : 'disabled'}`,
    'Bootstrap',
  );
}

void bootstrap();
