-- Global App State
CREATE TABLE app_state (
  id INT PRIMARY KEY DEFAULT 1,
  current_phase VARCHAR(50) DEFAULT 'RSVP_OPEN',
  winning_date VARCHAR(255),
  cinema_details TEXT,
  voting_dates TEXT[] DEFAULT '{"2026-12-18", "2026-12-19", "2026-12-20", "Too early, let''s settle this closer to December."}'
);

-- Users / RSVPs
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  voted_dates TEXT[],
  payment_receipt_url TEXT NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seats
CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_label VARCHAR(10) NOT NULL,
  seat_number INT NOT NULL,
  status VARCHAR(50) DEFAULT 'available',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Enable RLS
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;

-- App State Policies (Public read, internal update)
CREATE POLICY "Public read app_state" ON app_state FOR SELECT TO anon USING (true);
CREATE POLICY "Public read app_state auth" ON app_state FOR SELECT TO authenticated USING (true);

-- Users Policies
CREATE POLICY "Anyone can insert users" ON users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Public read users auth" ON users FOR SELECT TO authenticated USING (true);

-- Seats Policies
CREATE POLICY "Public read seats" ON seats FOR SELECT TO anon USING (true);
CREATE POLICY "Public read seats auth" ON seats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can update seats" ON seats FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can update seats auth" ON seats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Storage Policies
CREATE POLICY "Public Access avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Anyone can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Public read receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');

-- Initialize default app state
INSERT INTO app_state (id, current_phase, cinema_details) VALUES (1, 'RSVP_OPEN', 'TBD');
