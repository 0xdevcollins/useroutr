-- Allow link-initiated payments to exist before a quote / method is selected.
-- quoteId becomes nullable; source chain/asset/amount become nullable (filled
-- in when the customer picks a payment method on the hosted checkout);
-- destAmount becomes nullable so open-amount links land a row before the
-- customer enters an amount.

ALTER TABLE "Payment" ALTER COLUMN "quoteId"      DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "sourceChain"  DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "sourceAsset"  DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "sourceAmount" DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "destAmount"   DROP NOT NULL;
