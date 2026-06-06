import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DbModule } from './database/db.module';
import { AgencyModule } from './modules/agency/agency.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { IamModule } from './modules/iam/iam.module';
import { ScoresModule } from './modules/scores/scores.module';
import { ZonesModule } from './modules/zones/zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    DbModule,
    ScheduleModule.forRoot(),
    IamModule,
    ZonesModule,
    ScoresModule,
    AgencyModule,
    GeocodingModule,
    AlertsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
