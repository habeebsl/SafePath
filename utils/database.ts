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
