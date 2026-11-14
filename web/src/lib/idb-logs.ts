import { TelemetryLogEntry } from '@shared/types/tracker';

const DB_NAME = 'NavicTrackDB';
const DB_VERSION = 1;
const STORE_NAME = 'telemetry_logs';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache an array of TelemetryLogEntry items into browser IndexedDB.
 */
export async function cacheLogsInIndexedDB(entries: TelemetryLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const entry of entries) {
      store.put(entry);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to cache logs in IndexedDB:', err);
  }
}

/**
 * Retrieve all cached log records from IndexedDB, ordered by timestamp ascending.
 */
export async function getCachedLogsFromIndexedDB(): Promise<TelemetryLogEntry[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result as TelemetryLogEntry[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to read logs from IndexedDB:', err);
    return [];
  }
}

/**
 * Clear the local IndexedDB cache of telemetry logs.
 */
export async function clearIndexedDBLogs(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to clear logs in IndexedDB:', err);
  }
}

