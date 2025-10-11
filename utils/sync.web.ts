/**
 * Web-specific sync utilities (no-op since web talks directly to Supabase)
 */

// No sync needed on web - all operations go directly to Supabase
export function startSync() {
  console.log('📡 Sync not needed on web (using Supabase directly)');
}

export function stopSync() {
  // No-op
}

export function triggerManualSync() {
  // No-op
  return Promise.resolve();
}
