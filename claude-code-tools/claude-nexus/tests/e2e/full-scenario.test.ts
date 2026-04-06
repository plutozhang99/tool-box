import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, closeDatabase } from '../../src/local/database.js';
import { registerSession } from '../../src/local/session-registry.js';
import {
  sendMessage,
  readMessages,
  broadcastMessage,
} from '../../src/local/message-bus.js';
import type Database from 'better-sqlite3';

describe('E2E: Full CTO/Frontend/Backend collaboration', () => {
  let tempDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nexus-e2e-'));
    db = createDatabase(join(tempDir, 'test.db'));
  });

  afterEach(() => {
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('completes a full feature development communication flow', () => {
    // === Setup: Register all team members ===
    const cto = registerSession(db, 'cto', 'CTO - Sarah');
    const fe = registerSession(db, 'frontend', 'Frontend - Alex');
    const be = registerSession(db, 'backend', 'Backend - Jordan');

    // === Phase 1: CTO kicks off the feature ===
    broadcastMessage(
      db,
      tempDir,
      cto.id,
      'New feature: User dashboard. FE builds the UI, BE provides /api/dashboard endpoint. Target: end of sprint.',
    );

    // Both FE and BE receive the kickoff
    const feKickoff = readMessages(db, fe.id, 10, true);
    const beKickoff = readMessages(db, be.id, 10, true);
    expect(feKickoff).toHaveLength(1);
    expect(beKickoff).toHaveLength(1);

    // === Phase 2: Frontend asks Backend about API contract ===
    const apiQuestion = sendMessage(db, tempDir, fe.id, {
      toRole: 'backend',
      content: 'What data structure will /api/dashboard return? I need to know fields for the UI components.',
      messageType: 'request',
    });

    // Backend reads and responds
    const beInbox = readMessages(db, be.id, 10, true);
    expect(beInbox).toHaveLength(1);
    expect(beInbox[0]!.message_type).toBe('request');

    sendMessage(db, tempDir, be.id, {
      toSessionId: fe.id,
      content: JSON.stringify({
        endpoint: '/api/dashboard',
        response: {
          user: { id: 'string', name: 'string', avatar: 'string' },
          stats: { totalProjects: 'number', activeItems: 'number' },
          recentActivity: [{ type: 'string', description: 'string', timestamp: 'ISO8601' }],
        },
      }),
      messageType: 'response',
      inReplyTo: beInbox[0]!.id,
    });

    // Frontend reads the API spec
    const apiSpec = readMessages(db, fe.id, 10, true);
    expect(apiSpec).toHaveLength(1);
    expect(apiSpec[0]!.message_type).toBe('response');
    const specData = JSON.parse(apiSpec[0]!.content);
    expect(specData.endpoint).toBe('/api/dashboard');

    // === Phase 3: Backend notifies about implementation ===
    sendMessage(db, tempDir, be.id, {
      toRole: 'frontend',
      content: 'API endpoint /api/dashboard is now live on staging. Test at https://staging.example.com/api/dashboard',
    });

    sendMessage(db, tempDir, be.id, {
      toRole: 'cto',
      content: 'Backend dashboard API completed and deployed to staging.',
    });

    // === Phase 4: CTO checks status ===
    const ctoInbox = readMessages(db, cto.id, 20, true);
    expect(ctoInbox).toHaveLength(1);
    expect(ctoInbox[0]!.content).toContain('completed');

    // Frontend confirms integration
    const feNotification = readMessages(db, fe.id, 10, true);
    expect(feNotification).toHaveLength(1);
    expect(feNotification[0]!.content).toContain('staging');

    // === Phase 5: Frontend reports completion to CTO ===
    sendMessage(db, tempDir, fe.id, {
      toRole: 'cto',
      content: 'Dashboard UI integrated with backend API. Ready for review.',
    });

    const finalCtoInbox = readMessages(db, cto.id, 10, true);
    expect(finalCtoInbox).toHaveLength(1);
    expect(finalCtoInbox[0]!.content).toContain('Ready for review');

    // === Phase 6: CTO announces completion ===
    const completion = broadcastMessage(
      db,
      tempDir,
      cto.id,
      'Dashboard feature complete! Great teamwork. Moving to QA.',
    );
    expect(completion).toHaveLength(2);

    // Both receive the announcement
    expect(readMessages(db, fe.id, 10, true)).toHaveLength(1);
    expect(readMessages(db, be.id, 10, true)).toHaveLength(1);
  });
});
