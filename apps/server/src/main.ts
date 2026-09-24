import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import dns from 'node:dns';
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

  // Some home routers don't answer the DNS TXT lookups that mongodb+srv:// needs.
  // DNS_SERVERS (e.g. "8.8.8.8,1.1.1.1") lets local development use working resolvers.
  if (config.dnsServers.length) {
    dns.setServers(config.dnsServers);
    dns.promises.setServers(config.dnsServers);
    Logger.log(`Using DNS servers ${config.dnsServers.join(', ')}`, 'Bootstrap');
  }

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
