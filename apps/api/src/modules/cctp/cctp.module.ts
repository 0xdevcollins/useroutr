import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AttestationService } from './attestation.service.js';
import { CctpService } from './cctp.service.js';
import { EvmCctpClient } from './evm-cctp.client.js';
import { ForwarderService } from './forwarder.service.js';
import { RouterService } from './router.service.js';
import { StellarCctpClient } from './stellar-cctp.client.js';

/**
 * CCTP V2 module — owns every piece of the cross-chain story after the
 * migration (PR D). Consumers inject either:
 *
 *   - `RouterService`  → decide which provider a route lands on
 *   - `CctpService`    → prepare/observe a CCTP V2 transfer
 *
 * Internal clients (attestation, forwarder, EVM, Stellar) stay private
 * to the module so callers can't accidentally bypass orchestration.
 *
 * `ConfigModule` is imported so child services can resolve env vars
 * (STELLAR_NETWORK, RPC_*, STELLAR_SOROBAN_RPC_URL, …).
 */
@Module({
  imports: [ConfigModule],
  providers: [
    AttestationService,
    ForwarderService,
    EvmCctpClient,
    StellarCctpClient,
    RouterService,
    CctpService,
  ],
  exports: [RouterService, CctpService],
})
export class CctpModule {}
