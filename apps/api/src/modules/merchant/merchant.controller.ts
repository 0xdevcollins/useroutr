import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TeamRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentMerchant } from './decorators/current-merchant.decorator';
import { Roles } from './decorators/roles.decorator';
import { BrandingDto } from './dto/branding.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { KybSubmissionDto } from './dto/kyb-submission.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SettlementDto } from './dto/settlement.dto';
import { WithdrawSchema, type WithdrawDto } from './dto/withdraw.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { RolesGuard } from './guards/roles.guard';
import { MerchantService } from './merchant.service';
import { MerchantSettlementService } from './merchant-settlement.service';

@Controller('merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantController {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly settlement: MerchantSettlementService,
  ) {}

  // ── Profile ──────────────────────────────────────────────────

  @Get('me')
  getProfile(@CurrentMerchant('id') merchantId: string) {
    return this.merchantService.getById(merchantId);
  }

  @Patch('me')
  updateProfile(
    @CurrentMerchant('id') merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantService.update(merchantId, dto);
  }

  // ── Settlement ───────────────────────────────────────────────

  @Patch('me/settlement')
  updateSettlement(
    @CurrentMerchant('id') merchantId: string,
    @Body() dto: SettlementDto,
  ) {
    return this.merchantService.updateSettlement(merchantId, dto);
  }

  /**
   * Manually provision (or re-provision) a managed Stellar settlement
   * wallet. Idempotent — returns the existing address if one is already
   * on file. Used by:
   *
   *   - Merchants who registered before PR 7.9a shipped (settlementAddress
   *     is empty on their row)
   *   - Merchants who hit a transient Horizon outage at register time
   *     and need to retry
   *
   * Dashboard surfaces this as a one-click button in the settlement
   * settings card when `settlementAddress` is null.
   */
  @Post('me/settlement/provision')
  @HttpCode(HttpStatus.OK)
  provisionSettlement(@CurrentMerchant('id') merchantId: string) {
    return this.settlement.provision(merchantId);
  }

  /**
   * Move USDC out of the managed settlement wallet to an address the merchant
   * controls. Without this, managed custody is a roach motel: payments go in
   * and nothing comes out.
   *
   * Rate-limited to 3/hour — a compromised session should not be able to
   * drain a balance in a burst.
   *
   * This overrides the `default` bucket for this route rather than adding a
   * named global one. A named throttler registered in ThrottlerModule.forRoot
   * applies to *every* route, so a global `withdraw` bucket at 3/hour would
   * have capped the entire API at three requests an hour.
   */
  @Post('me/settlement/withdraw')
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  withdrawSettlement(
    @CurrentMerchant('id') merchantId: string,
    @Body(new ZodValidationPipe(WithdrawSchema)) dto: WithdrawDto,
  ) {
    return this.settlement.withdraw(merchantId, dto);
  }

  /**
   * Self-custodied withdrawal, step 1: we build it, they sign it.
   *
   * Split from the managed endpoint because a passkey wallet has no seed on
   * our side. WebAuthn is entirely a browser concern — all the server handles
   * is XDR, so no passkey-kit dependency is needed here.
   */
  @Post('me/settlement/withdraw/prepare')
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  prepareWithdrawal(
    @CurrentMerchant('id') merchantId: string,
    @Body(new ZodValidationPipe(WithdrawSchema)) dto: WithdrawDto,
  ) {
    return this.settlement.prepareWithdrawal(merchantId, dto);
  }

  /** Step 2: broadcast what they signed, after checking it is what we built. */
  @Post('me/settlement/withdraw/submit')
  @HttpCode(HttpStatus.OK)
  submitWithdrawal(
    @CurrentMerchant('id') merchantId: string,
    @Body() body: { withdrawalId: string; signedXdr: string },
  ) {
    if (!body?.withdrawalId || !body?.signedXdr) {
      throw new BadRequestException('withdrawalId and signedXdr are required');
    }
    return this.settlement.submitWithdrawal(
      merchantId,
      body.withdrawalId,
      body.signedXdr,
    );
  }

  // ── Branding ─────────────────────────────────────────────────

  @Patch('me/branding')
  updateBranding(
    @CurrentMerchant('id') merchantId: string,
    @Body() dto: BrandingDto,
  ) {
    return this.merchantService.updateBranding(merchantId, dto);
  }

  // ── Team Management ──────────────────────────────────────────

  @Get('me/team')
  getTeamMembers(@CurrentMerchant('id') merchantId: string) {
    return this.merchantService.getTeamMembers(merchantId);
  }

  @Post('me/team')
  @Roles(TeamRole.OWNER, TeamRole.ADMIN)
  inviteTeamMember(
    @CurrentMerchant('id') merchantId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.merchantService.inviteTeamMember(merchantId, dto);
  }

  @Patch('me/team/:id')
  @Roles(TeamRole.OWNER, TeamRole.ADMIN)
  updateMemberRole(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.merchantService.updateMemberRole(
      merchantId,
      memberId,
      dto.role,
    );
  }

  @Delete('me/team/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(TeamRole.OWNER)
  removeTeamMember(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') memberId: string,
  ) {
    return this.merchantService.removeTeamMember(merchantId, memberId);
  }

  // ── KYB ──────────────────────────────────────────────────────

  @Get('me/kyb')
  getKybStatus(@CurrentMerchant('id') merchantId: string) {
    return this.merchantService.getKybStatus(merchantId);
  }

  @Post('me/kyb')
  @HttpCode(HttpStatus.ACCEPTED)
  submitKyb(
    @CurrentMerchant('id') merchantId: string,
    @Body() dto: KybSubmissionDto,
  ) {
    return this.merchantService.submitKyb(merchantId, dto);
  }
}
