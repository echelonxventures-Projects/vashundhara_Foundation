import { Module } from '@nestjs/common';
import { HealthModule } from './health';
import { SettingsModule } from './settings';
import { WebhooksController, WebhooksService } from './webhooks';

@Module({ imports: [HealthModule, SettingsModule], providers: [WebhooksService], controllers: [WebhooksController], exports: [WebhooksService] })
export class SystemModule {}
