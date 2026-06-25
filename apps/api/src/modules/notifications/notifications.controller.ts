import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentMerchant } from '../merchant/decorators/current-merchant.decorator';
import { NotificationsService } from './notifications.service';

@Controller('v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(
    @CurrentMerchant('id') merchantId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.listNotifications(merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(merchantId, notificationId);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentMerchant('id') merchantId: string) {
    return this.notificationsService.markAllAsRead(merchantId);
  }
}
