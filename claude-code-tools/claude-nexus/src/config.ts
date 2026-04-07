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
  const rawDataDir = process.env['NEXUS_DATA_DIR'];
  if (!rawDataDir) {
    throw new Error(
      'NEXUS_DATA_DIR environment variable is required. ' +
      'Set it in your .mcp.json env field to a project-specific path (e.g., "~/.claude-nexus/my-project") ' +
      'to ensure data isolation between projects.',
    );
  }
  const dataDir = resolveHome(rawDataDir);
  const heartbeatInterval = parseIntSafe(process.env['NEXUS_HEARTBEAT_INTERVAL'], 30000);
  const relayUrl = process.env['NEXUS_RELAY_URL'] ?? null;
  const staleSessionTimeout = parseIntSafe(process.env['NEXUS_STALE_TIMEOUT'], 120000);
  const notifyDebounceMs = parseIntSafe(process.env['NEXUS_NOTIFY_DEBOUNCE'], 100);

  return Object.freeze({
    dataDir,
    heartbeatInterval,
    relayUrl,
    staleSessionTimeout,
    notifyDebounceMs,
  });
}
