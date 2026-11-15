ALTER TABLE "sf_pay_merchants" ADD COLUMN "enabled_methods" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "sf_pay_merchants" AS m
SET "enabled_methods" = COALESCE(
  (
    SELECT jsonb_agg(q.method)
    FROM (
      SELECT 'bank_transfer'::text AS method
      WHERE btrim(m.bank_iban) <> ''
      UNION ALL
      SELECT 'pay_at_entrance'
      WHERE btrim(m.entrance_instructions) <> ''
      UNION ALL
      SELECT 'cash'
      WHERE btrim(m.cash_instructions) <> ''
      UNION ALL
      SELECT c.kind
      FROM "sf_pay_merchant_credentials" AS c
      WHERE c.merchant_id = m.id
        AND c.kind IN ('barion', 'stripe')
        AND btrim(c.secret_cipher) <> ''
      UNION ALL
      SELECT 'paypal'
      FROM "sf_pay_merchant_credentials" AS c
      WHERE c.merchant_id = m.id
        AND c.kind = 'paypal'
        AND btrim(c.secret_cipher) <> ''
        AND btrim(COALESCE(c.meta->>'publicId', '')) <> ''
    ) AS q
  ),
  '[]'::jsonb
);
