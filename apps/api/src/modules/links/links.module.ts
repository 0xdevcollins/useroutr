import { Module } from '@nestjs/common';
import { LinksService } from './links.service.js';
import { LinksController } from './links.controller.js';
import { PublicLinksController } from './public-links.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [LinksService],
  controllers: [LinksController, PublicLinksController],
  exports: [LinksService],
})
export class LinksModule {}
