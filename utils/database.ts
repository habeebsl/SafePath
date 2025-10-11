import { Marker, MarkerType } from '@/types/marker';
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the SQLite database and create tables if they don't exist
 */
export async function initDatabase(): Promise<void> {
  // If already initialized, return
  if (db) {
    console.log('✅ Database already initialized');
    return;
  }

  // If currently initializing, wait for that to finish
  if (isInitializing && initPromise) {
    console.log('⏳ Waiting for database initialization...');
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('🔧 Opening database...');
      db = await SQLite.openDatabaseAsync('safepath.db');
      console.log('✅ Database opened');
      
      // Create markers table
      console.log('📋 Creating markers table...');
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS markers (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_verified INTEGER NOT NULL,
        agrees INTEGER DEFAULT 0,
        disagrees INTEGER DEFAULT 0,
        confidence_score REAL DEFAULT 100,
        synced_to_cloud INTEGER DEFAULT 0
      );
    `);

    // Create votes table to prevent duplicate votes
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marker_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        vote_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        UNIQUE(marker_id, device_id)
      );
    `);

    // Create device_info table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS device_info (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Create sync_queue table for pending cloud syncs
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marker_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        UNIQUE(marker_id, action)
      );
    `);

    // Create SOS markers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sos_markers (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
        completed_at INTEGER,
        expires_at INTEGER,
        synced_to_cloud INTEGER DEFAULT 0
      );
    `);

    // Create SOS responses table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sos_responses (
        id TEXT PRIMARY KEY,
        sos_marker_id TEXT NOT NULL,
        responder_device_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        current_latitude REAL,
        current_longitude REAL,
        distance_meters REAL,
        eta_minutes INTEGER,
        status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'arrived')),
        synced_to_cloud INTEGER DEFAULT 0,
        UNIQUE(sos_marker_id, responder_device_id)
      );
    `);

    // Migrate old sos_responses table if it exists with old schema
    try {
      // Check if old column exists
      const tableInfo = await db.getAllAsync<any>('PRAGMA table_info(sos_responses)');
      const hasOldColumn = tableInfo.some((col: any) => col.name === 'responded_at');
      
      if (hasOldColumn) {
        console.log('🔄 Migrating sos_responses table to new schema...');
        
        // Create new table with correct schema
        await db.execAsync(`
          CREATE TABLE sos_responses_new (
            id TEXT PRIMARY KEY,
            sos_marker_id TEXT NOT NULL,
            responder_device_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            current_latitude REAL,
            current_longitude REAL,
            distance_meters REAL,
            eta_minutes INTEGER,
            status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'arrived')),
            synced_to_cloud INTEGER DEFAULT 0,
            UNIQUE(sos_marker_id, responder_device_id)
          );
        `);
        
        // Copy data from old table, mapping responded_at to both created_at and updated_at
        await db.execAsync(`
          INSERT INTO sos_responses_new 
            (id, sos_marker_id, responder_device_id, created_at, updated_at, 
             current_latitude, current_longitude, distance_meters, eta_minutes, status, synced_to_cloud)
          SELECT 
            id, sos_marker_id, responder_device_id, responded_at, responded_at,
            current_latitude, current_longitude, distance_meters, eta_minutes, 
            CASE 
              WHEN status = 'responding' THEN 'active'
              ELSE status 
            END,
            synced_to_cloud
          FROM sos_responses;
        `);
        
        // Drop old table and rename new one
        await db.execAsync(`
          DROP TABLE sos_responses;
          ALTER TABLE sos_responses_new RENAME TO sos_responses;
        `);
        
        console.log('✅ Migration completed successfully');
      }
    } catch (migrationError) {
      console.log('ℹ️ No migration needed or already completed');
    }

    // Create indexes for SOS tables
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sos_markers_status ON sos_markers(status);
      CREATE INDEX IF NOT EXISTS idx_sos_markers_location ON sos_markers(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_sos_responses_marker ON sos_responses(sos_marker_id);
      CREATE INDEX IF NOT EXISTS idx_sos_responses_status ON sos_responses(status);
    `);

    console.log('✅ Database initialized successfully');
    isInitializing = false;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    db = null;
    isInitializing = false;
    initPromise = null;
    throw error;
  }
  })();

  return initPromise;
}

/**
 * Get or generate device ID
 */
export async function getDeviceId(): Promise<string> {
  if (!db) throw new Error('Database not initialized');

  const result = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM device_info WHERE key = ?',
    ['device_id']
  );

  if (result?.value) {
    return result.value;
  }

  // Generate new device ID
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.runAsync(
    'INSERT INTO device_info (key, value) VALUES (?, ?)',
    ['device_id', deviceId]
  );

  return deviceId;
}

/**
 * Add a new marker to the database
 */
export async function addMarker(marker: Marker): Promise<void> {
  if (!db) {
    console.error('❌ Database not initialized when adding marker');
    throw new Error('Database not initialized');
  }

  try {
    await db.runAsync(
    `INSERT INTO markers (
      id, type, latitude, longitude, title, description,
      created_by, created_at, last_verified, agrees, disagrees,
      confidence_score, synced_to_cloud
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      marker.id,
      marker.type,
      marker.latitude,
      marker.longitude,
      marker.title,
      marker.description || '',
      marker.createdBy,
      marker.createdAt,
      marker.lastVerified,
      marker.agrees,
      marker.disagrees,
      marker.confidenceScore,
      marker.syncedToServer ? 1 : 0,
    ]
  );

  // Add to sync queue if not synced
  if (!marker.syncedToServer) {
    await addToSyncQueue(marker.id, 'insert');
  }

  console.log('✅ Marker added to database:', marker.id);
  } catch (error) {
    console.error('❌ Error adding marker to database:', error);
    throw error;
  }
}

/**
 * Get all markers from the database
 */
export async function getAllMarkers(): Promise<Marker[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM markers ORDER BY created_at DESC'
  );

  return rows.map(row => ({
    id: row.id,
    type: row.type as MarkerType,
    latitude: row.latitude,
    longitude: row.longitude,
    title: row.title,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastVerified: row.last_verified,
    agrees: row.agrees,
    disagrees: row.disagrees,
    confidenceScore: row.confidence_score,
    syncedToServer: row.synced_to_cloud === 1,
  }));
}

/**
 * Get markers within a bounding box
 */
export async function getMarkersInBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): Promise<Marker[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM markers 
     WHERE latitude BETWEEN ? AND ? 
     AND longitude BETWEEN ? AND ?
     ORDER BY created_at DESC`,
    [minLat, maxLat, minLng, maxLng]
  );

  return rows.map(row => ({
    id: row.id,
    type: row.type as MarkerType,
    latitude: row.latitude,
    longitude: row.longitude,
    title: row.title,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastVerified: row.last_verified,
    agrees: row.agrees,
    disagrees: row.disagrees,
    confidenceScore: row.confidence_score,
    syncedToServer: row.synced_to_cloud === 1,
  }));
}

/**
 * Update marker votes
 */
export async function updateMarkerVotes(
  markerId: string,
  agrees: number,
  disagrees: number,
  confidenceScore: number
): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `UPDATE markers 
     SET agrees = ?, disagrees = ?, confidence_score = ?, last_verified = ?, synced_to_cloud = 0
     WHERE id = ?`,
    [agrees, disagrees, confidenceScore, Date.now(), markerId]
  );

  // Add to sync queue
  await addToSyncQueue(markerId, 'update');

  console.log('✅ Marker votes updated:', markerId);
}

/**
 * Get user's vote for a marker
 */
export async function getUserVote(
  markerId: string,
  deviceId: string
): Promise<'agree' | 'disagree' | null> {
  if (!db) throw new Error('Database not initialized');

  const result = await db.getFirstAsync<{ vote_type: string }>(
    'SELECT vote_type FROM votes WHERE marker_id = ? AND device_id = ?',
    [markerId, deviceId]
  );

  return result ? (result.vote_type as 'agree' | 'disagree') : null;
}

/**
 * Add a vote for a marker
 */
export async function addVote(
  markerId: string,
  deviceId: string,
  voteType: 'agree' | 'disagree'
): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `INSERT OR REPLACE INTO votes (marker_id, device_id, vote_type, timestamp)
     VALUES (?, ?, ?, ?)`,
    [markerId, deviceId, voteType, Date.now()]
  );

  console.log('✅ Vote added:', markerId, voteType);
}

/**
 * Add marker to sync queue
 */
async function addToSyncQueue(markerId: string, action: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `INSERT OR REPLACE INTO sync_queue (marker_id, action, timestamp)
     VALUES (?, ?, ?)`,
    [markerId, action, Date.now()]
  );
}

/**
 * Get pending sync queue items
 */
export async function getSyncQueue(): Promise<Array<{ marker_id: string; action: string }>> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<{ marker_id: string; action: string }>(
    'SELECT marker_id, action FROM sync_queue ORDER BY timestamp ASC'
  );

  return rows;
}

/**
 * Mark marker as synced
 */
export async function markMarkerAsSynced(markerId: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'UPDATE markers SET synced_to_cloud = 1 WHERE id = ?',
    [markerId]
  );

  await db.runAsync(
    'DELETE FROM sync_queue WHERE marker_id = ?',
    [markerId]
  );

  console.log('✅ Marker marked as synced:', markerId);
}

/**
 * Get unsynced markers
 */
export async function getUnsyncedMarkers(): Promise<Marker[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM markers WHERE synced_to_cloud = 0'
  );

  return rows.map(row => ({
    id: row.id,
    type: row.type as MarkerType,
    latitude: row.latitude,
    longitude: row.longitude,
    title: row.title,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastVerified: row.last_verified,
    agrees: row.agrees,
    disagrees: row.disagrees,
    confidenceScore: row.confidence_score,
    syncedToServer: false,
  }));
}

/**
 * Upsert marker (insert or update if exists)
 */
export async function upsertMarker(marker: Marker): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `INSERT OR REPLACE INTO markers (
      id, type, latitude, longitude, title, description,
      created_by, created_at, last_verified, agrees, disagrees,
      confidence_score, synced_to_cloud
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      marker.id,
      marker.type,
      marker.latitude,
      marker.longitude,
      marker.title,
      marker.description || '',
      marker.createdBy,
      marker.createdAt,
      marker.lastVerified,
      marker.agrees,
      marker.disagrees,
      marker.confidenceScore,
      1, // From cloud, so it's synced
    ]
  );

  console.log('✅ Marker upserted from cloud:', marker.id);
}

// ============================================================================
// SOS SYSTEM FUNCTIONS
// ============================================================================

/**
 * Create a new SOS marker
 */
export async function createSOSMarker(sosMarker: {
  id: string;
  latitude: number;
  longitude: number;
  createdBy: string;
  createdAt: number;
}): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `INSERT INTO sos_markers (
      id, latitude, longitude, created_by, created_at, status, synced_to_cloud
    ) VALUES (?, ?, ?, ?, ?, 'active', 0)`,
    [
      sosMarker.id,
      sosMarker.latitude,
      sosMarker.longitude,
      sosMarker.createdBy,
      sosMarker.createdAt,
    ]
  );

  console.log('✅ SOS marker created:', sosMarker.id);
}

/**
 * Get all active SOS markers
 */
export async function getActiveSOSMarkers(): Promise<any[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM sos_markers WHERE status = 'active' ORDER BY created_at DESC`
  );

  return rows;
}

/**
 * Get user's active SOS request
 */
export async function getUserActiveSOSRequest(deviceId: string): Promise<any | null> {
  if (!db) throw new Error('Database not initialized');

  const row = await db.getFirstAsync<any>(
    `SELECT * FROM sos_markers WHERE created_by = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [deviceId]
  );

  return row || null;
}

/**
 * Complete an SOS marker
 */
export async function completeSOSMarker(sosId: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  const completedAt = Date.now();
  const expiresAt = completedAt + (5 * 60 * 1000); // 5 minutes from now

  const result = await db.runAsync(
    `UPDATE sos_markers 
     SET status = 'completed', completed_at = ?, expires_at = ?, synced_to_cloud = 0
     WHERE id = ?`,
    [completedAt, expiresAt, sosId]
  );

  console.log('✅ SOS marker completed:', sosId, '- rows affected:', result.changes);
  console.log('🔄 Marked as unsynced, will push to cloud on next sync');
}

/**
 * Delete an SOS marker (for cleanup)
 */
export async function deleteSOSMarker(sosId: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync('DELETE FROM sos_markers WHERE id = ?', [sosId]);
  await db.runAsync('DELETE FROM sos_responses WHERE sos_marker_id = ?', [sosId]);

  console.log('✅ SOS marker deleted:', sosId);
}

/**
 * Delete all completed SOS markers from local database
 */
export async function deleteCompletedSOSMarkers(): Promise<number> {
  if (!db) throw new Error('Database not initialized');

  const result = await db.runAsync(
    `DELETE FROM sos_markers WHERE status = 'completed'`
  );

  return result.changes || 0;
}

/**
 * Get ALL SOS markers (including completed) for debugging
 */
export async function getAllSOSMarkersDebug(): Promise<any[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    `SELECT id, status FROM sos_markers ORDER BY created_at DESC`
  );

  return rows;
}

/**
 * Delete ALL SOS markers from local database (for cleanup/reset)
 */
export async function deleteAllSOSMarkers(): Promise<number> {
  if (!db) throw new Error('Database not initialized');

  const result = await db.runAsync('DELETE FROM sos_markers');
  
  return result.changes || 0;
}

/**
 * Add SOS response
 */
export async function addSOSResponse(response: {
  sosMarkerId: string;
  responderDeviceId: string;
  currentLatitude: number;
  currentLongitude: number;
  distanceMeters: number;
  etaMinutes: number;
}): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  const responseId = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO sos_responses (
      id, sos_marker_id, responder_device_id, created_at, updated_at,
      current_latitude, current_longitude, distance_meters, eta_minutes,
      status, synced_to_cloud
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
    [
      responseId,
      response.sosMarkerId,
      response.responderDeviceId,
      now,
      now,
      response.currentLatitude,
      response.currentLongitude,
      response.distanceMeters,
      response.etaMinutes,
    ]
  );

  console.log('✅ SOS response added:', response.sosMarkerId);
}

/**
 * Get responses for an SOS marker
 */
export async function getSOSResponses(sosMarkerId: string): Promise<any[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM sos_responses 
     WHERE sos_marker_id = ? AND status = 'active'
     ORDER BY created_at ASC`,
    [sosMarkerId]
  );

  return rows;
}

/**
 * Update responder location and ETA
 */
export async function updateResponderLocation(
  sosMarkerId: string,
  responderDeviceId: string,
  latitude: number,
  longitude: number,
  distanceMeters: number,
  etaMinutes: number
): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `UPDATE sos_responses 
     SET current_latitude = ?, current_longitude = ?, 
         distance_meters = ?, eta_minutes = ?, synced_to_cloud = 0
     WHERE sos_marker_id = ? AND responder_device_id = ?`,
    [latitude, longitude, distanceMeters, etaMinutes, sosMarkerId, responderDeviceId]
  );
}

/**
 * Cancel SOS response
 */
export async function cancelSOSResponse(
  sosMarkerId: string,
  responderDeviceId: string
): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `UPDATE sos_responses 
     SET status = 'cancelled', synced_to_cloud = 0
     WHERE sos_marker_id = ? AND responder_device_id = ?`,
    [sosMarkerId, responderDeviceId]
  );

  console.log('✅ SOS response cancelled:', sosMarkerId);
}

/**
 * Get user's active SOS response
 */
export async function getUserActiveSOSResponse(deviceId: string): Promise<any | null> {
  if (!db) throw new Error('Database not initialized');

  const row = await db.getFirstAsync<any>(
    `SELECT * FROM sos_responses 
     WHERE responder_device_id = ? AND status = 'active'`,
    [deviceId]
  );

  return row || null;
}

/**
 * Get unsynced SOS markers
 */
export async function getUnsyncedSOSMarkers(): Promise<any[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sos_markers WHERE synced_to_cloud = 0'
  );

  return rows;
}

/**
 * Get unsynced SOS responses
 */
export async function getUnsyncedSOSResponses(): Promise<any[]> {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sos_responses WHERE synced_to_cloud = 0'
  );

  return rows;
}

/**
 * Mark SOS marker as synced
 */
export async function markSOSMarkerAsSynced(sosId: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'UPDATE sos_markers SET synced_to_cloud = 1 WHERE id = ?',
    [sosId]
  );
}

/**
 * Mark SOS response as synced
 */
export async function markSOSResponseAsSynced(responseId: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'UPDATE sos_responses SET synced_to_cloud = 1 WHERE id = ?',
    [responseId]
  );
}

/**
 * Upsert SOS marker from cloud
 */
export async function upsertSOSMarker(sosMarker: any): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `INSERT OR REPLACE INTO sos_markers (
      id, latitude, longitude, created_by, created_at, status,
      completed_at, expires_at, synced_to_cloud
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      sosMarker.id,
      sosMarker.latitude,
      sosMarker.longitude,
      sosMarker.created_by,
      sosMarker.created_at,
      sosMarker.status,
      sosMarker.completed_at || null,
      sosMarker.expires_at || null,
    ]
  );
}

/**
 * Upsert SOS response from cloud
 */
export async function upsertSOSResponse(response: any): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    `INSERT OR REPLACE INTO sos_responses (
      id, sos_marker_id, responder_device_id, created_at, updated_at,
      current_latitude, current_longitude, distance_meters, eta_minutes,
      status, synced_to_cloud
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      response.id,
      response.sos_marker_id,
      response.responder_device_id,
      response.created_at,
      response.updated_at,
      response.current_latitude,
      response.current_longitude,
      response.distance_meters,
      response.eta_minutes,
      response.status,
    ]
  );
}
