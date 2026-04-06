import { mkdirSync, writeFileSync, watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';

export function getNotifyDir(dataDir: string): string {
  const dir = join(dataDir, 'notify');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function notifySession(dataDir: string, sessionId: string): void {
  const notifyDir = getNotifyDir(dataDir);
  const filePath = join(notifyDir, sessionId);
  try {
    writeFileSync(filePath, Date.now().toString());
  } catch (err) {
    logger.warn('Failed to notify session', { sessionId, error: String(err) });
  }
}

export function watchForNotifications(
  dataDir: string,
  sessionId: string,
  callback: () => void,
  debounceMs: number = 100,
): () => void {
  const notifyDir = getNotifyDir(dataDir);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;

  try {
    watcher = watch(notifyDir, (eventType, filename) => {
      if (filename === sessionId) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          callback();
        }, debounceMs);
      }
    });
  } catch (err) {
    logger.warn('Failed to set up file watcher', { error: String(err) });
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (watcher) watcher.close();
  };
}
