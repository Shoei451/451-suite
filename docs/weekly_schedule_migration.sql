-- Run this in Supabase SQL Editor (Project 2: 451-n)
CREATE TABLE IF NOT EXISTS weekly_schedule (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour float NOT NULL CHECK (start_hour >= 0 AND start_hour < 24),
  end_hour float NOT NULL CHECK (end_hour > 0 AND end_hour <= 24),
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6d28d9',
  notify_before smallint NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_range CHECK (end_hour > start_hour)
);

ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON weekly_schedule
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON weekly_schedule
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own" ON weekly_schedule
  FOR DELETE USING (auth.uid() = user_id);
