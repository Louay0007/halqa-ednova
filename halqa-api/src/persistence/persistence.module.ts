import { Module } from '@nestjs/common';
import { InjectConnection, MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { APP_CONFIG } from '../core/config/config.module';
import { CoreModule } from '../core/core.module';
import type { AppConfig } from '../core/config/app-config';
import { UnitOfWork } from './unit-of-work';
import { SCHEMA_REGISTRY } from './model-registry';

@Module({
  imports: [
    CoreModule,
    MongooseModule.forRootAsync({
      imports: [CoreModule],
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        uri: cfg.MONGODB_URI,
        retryWrites: true,
        retryReads: true,
        serverSelectionTimeoutMS: 5000,
        // Sized for the §1 target (200 concurrent learners on ~40 circles):
        // enough sockets for the pollers without each pod opening hundreds.
        maxPoolSize: 20,
        minPoolSize: 2,
        // Never let Mongoose build indexes on boot in production. It is O(collection
        // size), it delays readiness, and concurrent boots race each other. Indexes
        // are created explicitly by `scripts/migrate-indexes.ts` before traffic.
        autoIndex: !cfg.isProd,
        // Surface a dropped connection as a log line instead of silent retries.
        connectionErrorFactory: (e: Error) => e,
      }),
    }),
    // Single source of truth, shared with scripts/migrate-indexes.ts.
    MongooseModule.forFeature([...SCHEMA_REGISTRY]),
  ],
  providers: [
    UnitOfWork,
    {
      provide: 'MONGO_READY',
      inject: [getConnectionToken()],
      useFactory: async (conn: Connection) => {
        await conn.asPromise();
        return conn.readyState === 1;
      },
    },
  ],
  exports: [MongooseModule, UnitOfWork],
})
export class PersistenceModule {
  constructor(@InjectConnection() _conn: Connection) {
    void _conn;
  }
}
