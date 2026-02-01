-- ============================================
-- Payment Gateway Settings - Quick Setup Guide
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. Login ke Supabase Dashboard (https://supabase.com)
-- 2. Pilih project "texa-v2"
-- 3. Navigate ke SQL Editor
-- 4. Copy-paste SEMUA kode dibawah ini
-- 5. Klik "Run" atau tekan Ctrl+Enter
-- 6. Verify success message
--
-- ============================================

-- Step 1: Create payment_gateways table
CREATE TABLE IF NOT EXISTS payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('tokopay', 'midtrans', 'xendit', 'other')),
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_default_gateway UNIQUE NULLS NOT DISTINCT (
        CASE WHEN is_default THEN true ELSE NULL END
    )
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_gateways_type ON payment_gateways(type);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_active ON payment_gateways(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_default ON payment_gateways(is_default);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_created ON payment_gateways(created_at DESC);

-- Step 3: Enable RLS
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
-- Policy for authenticated users to read
CREATE POLICY IF NOT EXISTS "Enable read for authenticated users"
ON payment_gateways FOR SELECT
TO authenticated
USING (true);

-- Policy for admin users to insert
CREATE POLICY IF NOT EXISTS "Enable insert for admin users"
ON payment_gateways FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- Policy for admin users to update
CREATE POLICY IF NOT EXISTS "Enable update for admin users"
ON payment_gateways FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- Policy for admin users to delete
CREATE POLICY IF NOT EXISTS "Enable delete for admin users"
ON payment_gateways FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- Step 5: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payment_gateways_updated_at ON payment_gateways;
CREATE TRIGGER update_payment_gateways_updated_at
    BEFORE UPDATE ON payment_gateways
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Insert default TokoPay configuration
-- IMPORTANT: Replace with your actual TokoPay credentials!
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

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything is working:

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_gateways'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'payment_gateways';

-- Check policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'payment_gateways';

-- Check data
SELECT id, name, type, is_active, is_default, config
FROM payment_gateways;

-- ============================================
-- SUCCESS!
-- ============================================
-- If you see the TokoPay entry above, migration is complete!
-- Next: Go to Admin Dashboard > Payment Gateways tab
-- ============================================
