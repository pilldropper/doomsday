-- Global App State
CREATE TABLE IF NOT EXISTS app_state (
  id INT PRIMARY KEY DEFAULT 1,
  current_phase VARCHAR(50) DEFAULT 'RSVP_OPEN',
  winning_date VARCHAR(255),
  booking_schedule_id UUID,
  cinema_details TEXT,
  voting_dates TEXT[] DEFAULT '{"2026-12-18", "2026-12-19", "2026-12-20", "Too early, let''s settle this closer to December."}'
);

ALTER TABLE app_state ADD COLUMN IF NOT EXISTS booking_schedule_id UUID;

-- Users / RSVPs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  password TEXT,
  avatar_url TEXT,
  voted_dates TEXT[],
  voted_schedule_ids UUID[] DEFAULT '{}',
  is_available BOOLEAN DEFAULT NULL,
  payment_receipt_url TEXT NOT NULL DEFAULT '',
  payment_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS voted_schedule_ids UUID[] DEFAULT '{}';

-- MovieWorld showtimes and manually maintained public availability
CREATE TABLE IF NOT EXISTS movie_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue VARCHAR(255) NOT NULL,
  show_date DATE NOT NULL,
  cinema VARCHAR(50) NOT NULL,
  showtime TIME NOT NULL,
  booked_seats INT NOT NULL DEFAULT 0 CHECK (booked_seats >= 0),
  total_seats INT NOT NULL DEFAULT 100 CHECK (total_seats > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (venue, show_date, cinema, showtime)
);

-- Seats
CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_schedule_id UUID REFERENCES movie_schedules(id) ON DELETE CASCADE,
  row_label VARCHAR(10) NOT NULL,
  seat_number INT NOT NULL,
  status VARCHAR(50) DEFAULT 'available',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE seats ADD COLUMN IF NOT EXISTS booking_schedule_id UUID REFERENCES movie_schedules(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS seats_booking_schedule_position_idx
  ON seats (booking_schedule_id, row_label, seat_number);

-- MovieWorld per-seat availability snapshot (separate from our own booking seats)
CREATE TABLE IF NOT EXISTS movie_schedule_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES movie_schedules(id) ON DELETE CASCADE,
  row_label VARCHAR(10) NOT NULL,
  seat_number INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (schedule_id, row_label, seat_number)
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
ALTER TABLE movie_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_schedule_seats ENABLE ROW LEVEL SECURITY;

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

-- Movie schedule policies
CREATE POLICY "Public read movie_schedules" ON movie_schedules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert movie_schedules" ON movie_schedules FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update movie_schedules" ON movie_schedules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete movie_schedules" ON movie_schedules FOR DELETE TO anon, authenticated USING (true);

-- Movie schedule seat snapshot policies
CREATE POLICY "Public read movie_schedule_seats" ON movie_schedule_seats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert movie_schedule_seats" ON movie_schedule_seats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update movie_schedule_seats" ON movie_schedule_seats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete movie_schedule_seats" ON movie_schedule_seats FOR DELETE TO anon, authenticated USING (true);

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
ALTER PUBLICATION supabase_realtime ADD TABLE app_state, users, seats, chat_messages, movie_schedules, movie_schedule_seats;

-- Initial MovieWorld schedule options from the supplied listings.
INSERT INTO movie_schedules (venue, show_date, cinema, showtime)
SELECT 'Robinsons Marasbaras', d::date, 'Cinema 4', t::time
FROM generate_series('2026-12-16'::date, '2026-12-22'::date, '1 day') AS dates(d)
CROSS JOIN unnest(ARRAY['12:00', '15:30', '19:00']) AS times(t)
WHERE d <> '2026-12-16'::date OR t IN ('12:00', '15:30')
ON CONFLICT (venue, show_date, cinema, showtime) DO NOTHING;

INSERT INTO movie_schedules (venue, show_date, cinema, showtime)
SELECT 'Robinsons North Tacloban', d::date, c.cinema, c.showtime::time
FROM generate_series('2026-12-16'::date, '2026-12-22'::date, '1 day') AS dates(d)
CROSS JOIN (VALUES
  ('Cinema 1', '10:30'), ('Cinema 3', '12:00'), ('Cinema 1', '13:50'),
  ('Cinema 4', '16:00'), ('Cinema 1', '17:10'), ('Cinema 2', '20:00'),
  ('Cinema 1', '20:30')
) AS c(cinema, showtime)
ON CONFLICT (venue, show_date, cinema, showtime) DO NOTHING;

-- Dec 16 reference snapshot: Robinsons North Tacloban, Cinema 2, 8:00 PM
WITH target AS (
  SELECT id AS schedule_id
  FROM movie_schedules
  WHERE venue = 'Robinsons North Tacloban'
    AND show_date = '2026-12-16'
    AND cinema = 'Cinema 2'
    AND showtime = '20:00'
  LIMIT 1
),
rows AS (
  SELECT unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O']) AS row_label
),
nums AS (
  SELECT generate_series(1, 19) AS seat_number
)
INSERT INTO movie_schedule_seats (schedule_id, row_label, seat_number, status)
SELECT
  t.schedule_id,
  r.row_label,
  n.seat_number,
  CASE
    WHEN n.seat_number IN (6, 14) THEN 'space'
    ELSE 'available'
  END
FROM target t
CROSS JOIN rows r
CROSS JOIN nums n
ON CONFLICT (schedule_id, row_label, seat_number) DO NOTHING;

WITH target AS (
  SELECT id AS schedule_id
  FROM movie_schedules
  WHERE venue = 'Robinsons North Tacloban'
    AND show_date = '2026-12-16'
    AND cinema = 'Cinema 2'
    AND showtime = '20:00'
  LIMIT 1
)
UPDATE movie_schedule_seats mss
SET status = 'reserved'
FROM target t
WHERE mss.schedule_id = t.schedule_id
  AND (
    (mss.row_label IN ('F','G','H','I') AND mss.seat_number BETWEEN 8 AND 13) OR
    (mss.row_label IN ('J','K','L','M','N','O') AND mss.seat_number BETWEEN 8 AND 12) OR
    (mss.row_label IN ('C','D','E') AND mss.seat_number BETWEEN 9 AND 11) OR
    (mss.row_label IN ('K','M','N','O') AND mss.seat_number BETWEEN 4 AND 5) OR
    (mss.row_label = 'J' AND mss.seat_number IN (15, 16))
  );

UPDATE movie_schedules ms
SET
  total_seats = (
    SELECT count(*)
    FROM movie_schedule_seats mss
    WHERE mss.schedule_id = ms.id
      AND mss.status <> 'space'
  ),
  booked_seats = (
    SELECT count(*)
    FROM movie_schedule_seats mss
    WHERE mss.schedule_id = ms.id
      AND mss.status = 'reserved'
  )
WHERE ms.venue = 'Robinsons North Tacloban'
  AND ms.show_date = '2026-12-16'
  AND ms.cinema = 'Cinema 2'
  AND ms.showtime = '20:00';
