-- ============================================
-- SafePath: Row Level Security (RLS) Fix
-- ============================================
-- Run this in your Supabase SQL Editor to fix "unrestricted" tables
-- This enables RLS and adds policies for all tables

-- ============================================
-- 1. MARKERS TABLE
-- ============================================

-- Enable Row Level Security on markers table
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access" ON markers;
DROP POLICY IF EXISTS "Allow public insert access" ON markers;
DROP POLICY IF EXISTS "Allow public update access" ON markers;

-- Create policies for markers
CREATE POLICY "Allow public read access" ON markers
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON markers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON markers
  FOR UPDATE USING (true);

-- ============================================
-- 2. VOTES TABLE
-- ============================================

-- Enable Row Level Security on votes table (if it exists)
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON votes;
DROP POLICY IF EXISTS "Allow public insert access" ON votes;

-- Create policies for votes
CREATE POLICY "Allow public read access" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON votes
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 3. SOS_MARKERS TABLE
-- ============================================

-- Enable Row Level Security on sos_markers table
ALTER TABLE sos_markers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON sos_markers;
DROP POLICY IF EXISTS "Allow public insert access" ON sos_markers;
DROP POLICY IF EXISTS "Allow creator update access" ON sos_markers;
DROP POLICY IF EXISTS "Allow public delete access" ON sos_markers;

-- Create policies for sos_markers
CREATE POLICY "Allow public read access" ON sos_markers
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON sos_markers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow creator update access" ON sos_markers
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON sos_markers
  FOR DELETE USING (true);

-- ============================================
-- 4. SOS_RESPONSES TABLE
-- ============================================

-- Enable Row Level Security on sos_responses table
ALTER TABLE sos_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON sos_responses;
DROP POLICY IF EXISTS "Allow public insert access" ON sos_responses;
DROP POLICY IF EXISTS "Allow responder update access" ON sos_responses;
DROP POLICY IF EXISTS "Allow public delete access" ON sos_responses;

-- Create policies for sos_responses
CREATE POLICY "Allow public read access" ON sos_responses
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON sos_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow responder update access" ON sos_responses
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON sos_responses
  FOR DELETE USING (true);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check RLS status for all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('markers', 'votes', 'sos_markers', 'sos_responses')
ORDER BY tablename;

-- Check policies for all tables
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('markers', 'votes', 'sos_markers', 'sos_responses')
ORDER BY tablename, policyname;
