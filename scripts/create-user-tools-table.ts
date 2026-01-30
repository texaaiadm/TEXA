// Script to create user_tools table in Supabase
// Run with: npx tsx scripts/create-user-tools-table.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://odivixmsdxjyqeobalzv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function createUserToolsTable() {
    console.log('🔧 Creating user_tools table in Supabase...\n');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Check if table already exists by trying to query it
    const { error: checkError } = await supabase
        .from('user_tools')
        .select('id')
        .limit(1);

    if (!checkError) {
        console.log('✅ Table user_tools already exists!');
        return;
    }

    // If error is not "table doesn't exist", it's another issue
    if (checkError.code !== 'PGRST116' && checkError.code !== '42P01') {
        console.log('Table check error:', checkError);
    }

    console.log('📝 Table does not exist, creating via RPC or insert test...');

    // Try to create a test entry - this will fail if table doesn't exist
    // but let's provide the SQL that needs to be run manually
    console.log('\n⚠️  To create the table, run this SQL in Supabase SQL Editor:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS user_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    access_end TIMESTAMPTZ NOT NULL,
    order_ref_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tool_id)
);

-- Enable RLS
ALTER TABLE user_tools ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own tool access
CREATE POLICY "Users can view own tool access"
ON user_tools FOR SELECT
USING (auth.uid()::text = user_id);

-- Policy for service role to manage all
CREATE POLICY "Service role full access"
ON user_tools FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tools_user_id ON user_tools(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tools_access_end ON user_tools(access_end);
    `);

    console.log('\n📋 Copy the SQL above and paste it in Supabase Dashboard -> SQL Editor');
}

createUserToolsTable();
