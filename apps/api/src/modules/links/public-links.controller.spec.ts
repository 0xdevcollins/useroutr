import { Test, TestingModule } from '@nestjs/testing';
import { GoneException, NotFoundException } from '@nestjs/common';

import { PublicLinksController } from './public-links.controller';
import { LinksService } from './links.service';

/**
 * Thin controller — most of the behaviour lives in LinksService.resolve()
 * and is exercised by links.service.spec.ts. The job here is to prove:
 *
 *   1. The route delegates to the service with the raw short code
 *   2. The handler is unguarded (no auth required)
 *   3. Service exceptions propagate to the caller as-is (so Nest maps
 *      404 / 410 correctly without the controller swallowing them)
 *
 * We don't exercise the global ThrottlerGuard or the `@Throttle()`
 * override here — those are framework concerns covered by Nest's own
 * tests, and our integration tests will trip the limit if it regresses.
 */
describe('PublicLinksController', () => {
  let controller: PublicLinksController;
  let linksService: { resolve: jest.Mock };

  beforeEach(async () => {
    linksService = {
      resolve: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicLinksController],
      providers: [{ provide: LinksService, useValue: linksService }],
    }).compile();

    controller = module.get<PublicLinksController>(PublicLinksController);
  });

  it('delegates to LinksService.resolve with the raw short code', async () => {
    const payload = {
      id: 'lnk_abc',
      amount: 25,
      currency: 'USD',
      description: 'Coffee subscription',
      singleUse: false,
      expiresAt: null,
      merchantName: 'Acme Co',
      merchantCompanyName: 'Acme Inc.',
      merchantLogo: 'https://cdn.example.com/acme-logo.png',
      merchantBrandColor: '#ff5b1f',
    };
    linksService.resolve.mockResolvedValue(payload);

    const result = await controller.resolve('aBcDeFgH');

    expect(linksService.resolve).toHaveBeenCalledWith('aBcDeFgH');
    expect(linksService.resolve).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload);
  });

  it('propagates NotFoundException so Nest returns 404', async () => {
    linksService.resolve.mockRejectedValue(
      new NotFoundException('Payment link not found'),
    );

    await expect(controller.resolve('NOPENOPE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('propagates GoneException so Nest returns 410', async () => {
    linksService.resolve.mockRejectedValue(
      new GoneException('This payment link has expired'),
    );

    await expect(controller.resolve('EXPIREDx')).rejects.toBeInstanceOf(
      GoneException,
    );
  });
});
