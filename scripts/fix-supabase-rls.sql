-- Fix RLS (Row Level Security) Policy for Settings Table
-- Run this in Supabase SQL Editor

-- First, check if RLS is enabled on settings table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'settings';

-- Option 1: Disable RLS temporarily for settings table (simplest but less secure)
-- ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Option 2: Create permissive policies (recommended)

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read settings" ON settings;
DROP POLICY IF EXISTS "Allow anon read settings" ON settings;
DROP POLICY IF EXISTS "Allow authenticated read settings" ON settings;
DROP POLICY IF EXISTS "Allow authenticated insert settings" ON settings;
DROP POLICY IF EXISTS "Allow authenticated update settings" ON settings;
DROP POLICY IF EXISTS "Allow all read settings" ON settings;
DROP POLICY IF EXISTS "Allow all write settings" ON settings;

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read settings
CREATE POLICY "Allow all read settings" ON settings
  FOR SELECT
  USING (true);

-- Create policy to allow anyone to insert/update settings (for anon key usage)
CREATE POLICY "Allow all write settings" ON settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Alternative: If you want more secure write access (authenticated users only):
-- CREATE POLICY "Allow authenticated write settings" ON settings
--   FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'settings';

-- Also fix texa_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS texa_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on texa_transactions  
ALTER TABLE texa_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for texa_transactions
DROP POLICY IF EXISTS "Allow all read texa_transactions" ON texa_transactions;
DROP POLICY IF EXISTS "Allow all write texa_transactions" ON texa_transactions;

CREATE POLICY "Allow all read texa_transactions" ON texa_transactions
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all write texa_transactions" ON texa_transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Fix subscription_packages table
-- ============================================

-- Create subscription_packages table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_price NUMERIC(12,2),
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on subscription_packages
ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all read subscription_packages" ON subscription_packages;
DROP POLICY IF EXISTS "Allow all write subscription_packages" ON subscription_packages;

-- Create policies for subscription_packages
CREATE POLICY "Allow all read subscription_packages" ON subscription_packages
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all write subscription_packages" ON subscription_packages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verify all policies
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('settings', 'texa_transactions', 'subscription_packages')
ORDER BY tablename;
