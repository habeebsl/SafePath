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

## 3. Enable Realtime

1. Go to **Database** → **Replication** in your Supabase dashboard
2. Enable replication for the `markers` table
3. This allows the app to receive live updates when other users add markers

## 4. Get Your API Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (this is safe to use in your app)

## 5. Configure SafePath App

1. Open `/workspaces/SafePath/.env`
2. Replace the placeholder values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

3. Restart the Expo development server

## 6. Test the Setup

1. Add a marker in the app
2. Check the Supabase Table Editor to see if it appears
3. Add a marker from the Supabase dashboard manually:
   ```sql
   INSERT INTO markers (id, type, latitude, longitude, title, description, created_by, created_at, last_verified, agrees, disagrees, confidence_score)
   VALUES ('test_marker_1', 'safe', 40.7128, -74.0060, 'Test Safe Zone', 'This is a test marker', 'admin', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, 0, 0, 100);
   ```
4. The marker should appear in your app automatically (via real-time sync)

## 7. Monitor Sync Activity

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

## Optional Enhancements

### Add Geospatial Queries (PostGIS)

Enable PostGIS for better location-based queries:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE markers ADD COLUMN location GEOGRAPHY(POINT, 4326);

UPDATE markers SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);

CREATE INDEX idx_markers_location_gist ON markers USING GIST (location);
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
