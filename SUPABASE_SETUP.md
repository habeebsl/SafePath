# Supabase Setup for SafePath

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details:
   - **Name**: SafePath
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your target users
4. Click "Create new project" and wait for it to initialize

## 2. Create Database Tables

Go to the SQL Editor in your Supabase dashboard and run these commands:

### Create Markers Table

```sql
CREATE TABLE markers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_verified BIGINT NOT NULL,
  agrees INTEGER DEFAULT 0,
  disagrees INTEGER DEFAULT 0,
  confidence_score REAL DEFAULT 100,
  created_at_timestamp TIMESTAMP DEFAULT NOW()
);

-- Create index for location queries
CREATE INDEX idx_markers_location ON markers (latitude, longitude);

-- Create index for time-based queries
CREATE INDEX idx_markers_created_at ON markers (created_at);

-- Enable Row Level Security
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read markers
CREATE POLICY "Allow public read access" ON markers
  FOR SELECT USING (true);

-- Policy: Allow anyone to insert markers (anonymous users)
CREATE POLICY "Allow public insert access" ON markers
  FOR INSERT WITH CHECK (true);

-- Policy: Allow anyone to update markers
CREATE POLICY "Allow public update access" ON markers
  FOR UPDATE USING (true);
```

### Create Votes Table

```sql
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  marker_id TEXT NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('agree', 'disagree')),
  timestamp BIGINT NOT NULL,
  created_at_timestamp TIMESTAMP DEFAULT NOW(),
  UNIQUE(marker_id, device_id)
);

-- Create index for vote queries
CREATE INDEX idx_votes_marker_device ON votes (marker_id, device_id);

-- Enable Row Level Security
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read votes
CREATE POLICY "Allow public read access" ON votes
  FOR SELECT USING (true);

-- Policy: Allow anyone to insert votes
CREATE POLICY "Allow public insert access" ON votes
  FOR INSERT WITH CHECK (true);
```

## 3. Create SOS Emergency Tables

See the sections above for creating `sos_markers` and `sos_responses` tables with proper RLS policies.

## 4. Enable Realtime

1. Go to **Database** → **Replication** in your Supabase dashboard
2. Enable replication for these tables:
   - `markers`
   - `sos_markers`
   - `sos_responses`
3. This allows the app to receive live updates when data changes

## 5. Get Your API Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (this is safe to use in your app)

## 6. Configure SafePath App

1. Open `/workspaces/SafePath/.env`
2. Replace the placeholder values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

3. Restart the Expo development server

## 7. Test the Setup

1. Add a marker in the app
2. Check the Supabase Table Editor to see if it appears
3. Add a marker from the Supabase dashboard manually:
   ```sql
   INSERT INTO markers (id, type, latitude, longitude, title, description, created_by, created_at, last_verified, agrees, disagrees, confidence_score)
   VALUES ('test_marker_1', 'safe', 40.7128, -74.0060, 'Test Safe Zone', 'This is a test marker', 'admin', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, 0, 0, 100);
   ```
4. The marker should appear in your app automatically (via real-time sync)

## 8. Monitor Sync Activity

Check your console logs for:
- `✅ Database initialized successfully`
- `📡 Starting sync service...`
- `🔄 Starting sync...`
- `📤 Pushing X markers to cloud...`
- `📥 Pulled X new markers from cloud`
- `🔔 Real-time update received`

## Security Notes

- The `anon` key is safe to expose in your app (it's public)
- Row Level Security (RLS) policies control what users can access
- For production, consider adding rate limiting
- Consider adding authentication for user-specific features

### Create SOS Markers Table

```sql
CREATE TABLE sos_markers (
  id TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  created_at BIGINT NOT NULL,
  expires_at BIGINT,
  created_at_timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for location and time-based queries
CREATE INDEX idx_sos_markers_location ON sos_markers (latitude, longitude);
CREATE INDEX idx_sos_markers_status ON sos_markers (status);
CREATE INDEX idx_sos_markers_created_at ON sos_markers (created_at);

-- Enable Row Level Security
ALTER TABLE sos_markers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read SOS markers (so users can see nearby emergencies)
CREATE POLICY "Allow public read access" ON sos_markers
  FOR SELECT USING (true);

-- Policy: Allow anyone to insert SOS markers (emergency situations)
CREATE POLICY "Allow public insert access" ON sos_markers
  FOR INSERT WITH CHECK (true);

-- Policy: Allow creator to update their own SOS markers
CREATE POLICY "Allow creator update access" ON sos_markers
  FOR UPDATE USING (true);

-- Policy: Allow anyone to delete old/completed SOS markers (cleanup)
CREATE POLICY "Allow public delete access" ON sos_markers
  FOR DELETE USING (true);
```

### Create SOS Responses Table

```sql
CREATE TABLE sos_responses (
  id TEXT PRIMARY KEY,
  sos_marker_id TEXT NOT NULL REFERENCES sos_markers(id) ON DELETE CASCADE,
  responder_device_id TEXT NOT NULL,
  current_latitude REAL NOT NULL,
  current_longitude REAL NOT NULL,
  distance_meters INTEGER,
  eta_minutes INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'arrived')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_at_timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for queries
CREATE INDEX idx_sos_responses_marker ON sos_responses (sos_marker_id);
CREATE INDEX idx_sos_responses_responder ON sos_responses (responder_device_id);
CREATE INDEX idx_sos_responses_status ON sos_responses (status);

-- Enable Row Level Security
ALTER TABLE sos_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read SOS responses
CREATE POLICY "Allow public read access" ON sos_responses
  FOR SELECT USING (true);

-- Policy: Allow anyone to insert SOS responses (anyone can help)
CREATE POLICY "Allow public insert access" ON sos_responses
  FOR INSERT WITH CHECK (true);

-- Policy: Allow responders to update their own responses
CREATE POLICY "Allow responder update access" ON sos_responses
  FOR UPDATE USING (true);

-- Policy: Allow anyone to delete responses (cleanup)
CREATE POLICY "Allow public delete access" ON sos_responses
  FOR DELETE USING (true);
```

## 4. Enable Realtime for SOS Tables

1. Go to **Database** → **Replication** in your Supabase dashboard
2. Enable replication for both:
   - `sos_markers` table
   - `sos_responses` table
3. This allows real-time updates when emergencies are created or responses are added

## Optional Enhancements

### Add Geospatial Queries (PostGIS)

Enable PostGIS for better location-based queries:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE markers ADD COLUMN location GEOGRAPHY(POINT, 4326);
ALTER TABLE sos_markers ADD COLUMN location GEOGRAPHY(POINT, 4326);

UPDATE markers SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);
UPDATE sos_markers SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);

CREATE INDEX idx_markers_location_gist ON markers USING GIST (location);
CREATE INDEX idx_sos_markers_location_gist ON sos_markers USING GIST (location);
```

### Add Marker Analytics

```sql
CREATE TABLE marker_analytics (
  id SERIAL PRIMARY KEY,
  marker_id TEXT REFERENCES markers(id),
  views INTEGER DEFAULT 0,
  last_viewed BIGINT
);
```
