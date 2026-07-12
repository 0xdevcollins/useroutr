import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecipientsService } from './recipients.service';
import { CreateRecipientDto, CreateRecipientSchema } from './dto/create-recipient.dto';
import { RecipientFiltersDto, RecipientFiltersSchema } from './dto/recipient-filters.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { CombinedAuthGuard } from '../../common/guards/combined-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentMerchant } from '../merchant/decorators/current-merchant.decorator';

@Controller('recipients')
@UseGuards(CombinedAuthGuard)
export class RecipientsController {
  constructor(private readonly recipientsService: RecipientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentMerchant('id') merchantId: string,
    @Body(new ZodValidationPipe(CreateRecipientSchema))
    dto: CreateRecipientDto,
  ) {
    return this.recipientsService.create(merchantId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentMerchant('id') merchantId: string,
    @Query(new ZodValidationPipe(RecipientFiltersSchema))
    filters: RecipientFiltersDto,
  ) {
    return this.recipientsService.list(merchantId, filters);
  }

  @Get(':id')
  async getOne(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.recipientsService.getById(id, merchantId);
  }

  @Patch(':id')
  async update(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecipientDto,
  ) {
    return this.recipientsService.update(id, merchantId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.recipientsService.delete(id, merchantId);
  }
}
