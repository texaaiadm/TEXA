-- Payment Gateways Migration Script
-- This script creates the payment_gateways table and related indexes
-- Run this in Supabase SQL Editor

-- Create payment_gateways table
CREATE TABLE IF NOT EXISTS payment_gateways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL, -- Display name: "TokoPay", "Midtrans", etc.
  type VARCHAR(50) NOT NULL, -- Internal type: "tokopay", "midtrans", etc.
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  config JSONB NOT NULL, -- Dynamic config per gateway type
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_gateways_type ON payment_gateways(type);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_active ON payment_gateways(is_active);

-- Ensure only one default gateway at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_gateway 
  ON payment_gateways(is_default) 
  WHERE is_default = true;

-- Insert default TokoPay configuration (using env var values as default)
-- Note: Admin should update this with actual credentials via UI
INSERT INTO payment_gateways (name, type, is_active, is_default, config)
VALUES (
  'TokoPay',
  'tokopay',
  true,
  true,
  jsonb_build_object(
    'merchantId', 'M250828KEAYY483',
    'secretKey', 'b3bb79b23b82ed33a54927dbaac95d8a70e19de7f5d47a613d1db4d32776125c',
    'webhookIp', '178.128.104.179'
  )
)
ON CONFLICT DO NOTHING;

-- Add RLS policies for admin access
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read payment gateways
CREATE POLICY "Admin can read payment gateways"
  ON payment_gateways
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Policy: Only admins can insert payment gateways
CREATE POLICY "Admin can insert payment gateways"
  ON payment_gateways
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Policy: Only admins can update payment gateways
CREATE POLICY "Admin can update payment gateways"
  ON payment_gateways
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Policy: Only admins can delete payment gateways
CREATE POLICY "Admin can delete payment gateways"
  ON payment_gateways
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Payment gateways table created successfully!';
  RAISE NOTICE 'Default TokoPay gateway has been configured.';
  RAISE NOTICE 'Please update credentials via Admin Dashboard > Payment Gateways';
END $$;
