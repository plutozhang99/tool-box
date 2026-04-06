import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { NexusConfig } from './types.js';

function resolveHome(p: string): string {
  if (p.startsWith('~')) {
    return resolve(homedir(), p.slice(2));
  }
  return resolve(p);
}

// HIGH-7: Safe parseInt with NaN/negative guard
function parseIntSafe(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function loadConfig(): NexusConfig {
  const dataDir = resolveHome(process.env['NEXUS_DATA_DIR'] ?? '~/.claude-nexus');
  const heartbeatInterval = parseIntSafe(process.env['NEXUS_HEARTBEAT_INTERVAL'], 30000);
  const messageTtl = parseIntSafe(process.env['NEXUS_MESSAGE_TTL'], 86400000);
  const relayUrl = process.env['NEXUS_RELAY_URL'] ?? null;
  const staleSessionTimeout = parseIntSafe(process.env['NEXUS_STALE_TIMEOUT'], 120000);
  const notifyDebounceMs = parseIntSafe(process.env['NEXUS_NOTIFY_DEBOUNCE'], 100);

  return Object.freeze({
    dataDir,
    heartbeatInterval,
    messageTtl,
    relayUrl,
    staleSessionTimeout,
    notifyDebounceMs,
  });
}
