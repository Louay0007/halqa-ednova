import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import compression from 'compression';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { APP_CONFIG } from './core/config/config.module';
import type { AppConfig } from './core/config/app-config';
import { requestIdMiddleware } from './core/interceptors/request-id.middleware';
import { JsonLogger } from './core/logger/json.logger';

async function bootstrap(): Promise<void> {
  // Local dev convenience: `.env` fills gaps without overriding real env vars.
  // Tests set process.env directly and never reach this path.
  if (!process.env.MONGODB_URI) {
    try {
      loadEnvFile('.env');
    } catch {
      // No .env — real env vars are the only source, validated by loadConfig().
    }
  }

  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
    abortOnError: false,
  });
  const cfg = app.get<AppConfig>(APP_CONFIG);

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(compression());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  if (cfg.corsOrigins.length > 0) app.enableCors({ origin: cfg.corsOrigins });

  await app.listen(cfg.PORT);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'log', msg: `halqa-api listening on :${cfg.PORT}` }));
}

void bootstrap();
