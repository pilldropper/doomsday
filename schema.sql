-- Global App State
CREATE TABLE IF NOT EXISTS app_state (
  id INT PRIMARY KEY DEFAULT 1,
  current_phase VARCHAR(50) DEFAULT 'RSVP_OPEN',
  winning_date VARCHAR(255),
  cinema_details TEXT,
  voting_dates TEXT[] DEFAULT '{"2026-12-18", "2026-12-19", "2026-12-20", "Too early, let''s settle this closer to December."}'
);

-- Users / RSVPs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  password TEXT,
  avatar_url TEXT,
  voted_dates TEXT[],
  is_available BOOLEAN DEFAULT NULL,
  payment_receipt_url TEXT NOT NULL DEFAULT '',
  payment_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seats
CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_label VARCHAR(10) NOT NULL,
  seat_number INT NOT NULL,
  status VARCHAR(50) DEFAULT 'available',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage Buckets (both public so getPublicUrl works for avatars and receipts)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- App State Policies
CREATE POLICY "Public read app_state" ON app_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public update app_state" ON app_state FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Users Policies
CREATE POLICY "Anyone can insert users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public read users" ON users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can update users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete users" ON users FOR DELETE TO anon, authenticated USING (true);

-- Seats Policies
CREATE POLICY "Public read seats" ON seats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert seats" ON seats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update seats" ON seats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete seats" ON seats FOR DELETE TO anon, authenticated USING (true);

-- Chat Policies
CREATE POLICY "Public read chat_messages" ON chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert chat_messages" ON chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Storage Policies
CREATE POLICY "Public Access avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Anyone can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public read receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "Anyone can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');

-- Initialize default app state
INSERT INTO app_state (id, current_phase, cinema_details)
VALUES (1, 'RSVP_OPEN', 'TBD')
ON CONFLICT (id) DO NOTHING;

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE app_state, users, seats, chat_messages;
