import type { FastifyInstance } from 'fastify';
import { getDb, getSqliteDb } from '../db/index.js';
import { chatMessages } from '../db/schema.js';
import { desc, eq, lt } from 'drizzle-orm';
import { requirePermission, getRequestUser, hasPermission } from '../middleware/auth.js';
import { socketService } from '../services/socket.js';
import { dbHelpers } from '../db/index.js';

const MAX_BODY_LENGTH = 2000;
const MAX_MESSAGES = 500;
let tableReady = false;

function ensureChatTable(): void {
  if (tableReady) return;
  const sqlite = getSqliteDb();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
  `);
  tableReady = true;
}

function emitPanel(event: string, payload: unknown): void {
  try {
    const svc = socketService as unknown as { broadcastPanel?: (e: string, p: unknown) => void; io?: { to: (r: string) => { emit: (e: string, p: unknown) => void } } };
    if (typeof svc.broadcastPanel === 'function') {
      svc.broadcastPanel(event, payload);
      return;
    }
    // fallback if broadcastPanel not present yet
    svc.io?.to?.('admin')?.emit?.(event, payload);
  } catch {
    // realtime optional
  }
}

export async function chatRoutes(app: FastifyInstance) {
  app.get('/api/chat/messages', {
    preHandler: [app.auth, requirePermission('chat:view')],
  }, async (request) => {
    ensureChatTable();
    const query = request.query as { limit?: string; before?: string };
    const limit = Math.min(Math.max(parseInt(query.limit || '100', 10) || 100, 1), 200);
    const d = getDb();

    let rows;
    if (query.before) {
      const beforeId = parseInt(query.before, 10);
      if (!Number.isFinite(beforeId)) {
        return { success: false, error: 'Invalid before id' };
      }
      rows = d
        .select({
          id: chatMessages.id,
          userId: chatMessages.userId,
          username: chatMessages.username,
          role: chatMessages.role,
          body: chatMessages.body,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(lt(chatMessages.id, beforeId))
        .orderBy(desc(chatMessages.id))
        .limit(limit)
        .all();
    } else {
      rows = d
        .select({
          id: chatMessages.id,
          userId: chatMessages.userId,
          username: chatMessages.username,
          role: chatMessages.role,
          body: chatMessages.body,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .orderBy(desc(chatMessages.id))
        .limit(limit)
        .all();
    }

    return { success: true, data: rows.reverse() };
  });

  app.post('/api/chat/messages', {
    preHandler: [app.auth, requirePermission('chat:view')],
  }, async (request, reply) => {
    ensureChatTable();
    const body = request.body as { body?: string };
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) {
      reply.code(400);
      return { success: false, error: 'Message cannot be empty' };
    }
    if (text.length > MAX_BODY_LENGTH) {
      reply.code(400);
      return { success: false, error: `Message too long (max ${MAX_BODY_LENGTH})` };
    }

    const sessionUser = getRequestUser(request);
    const d = getDb();
    const result = d
      .insert(chatMessages)
      .values({
        userId: sessionUser.userId,
        username: sessionUser.username,
        role: sessionUser.role,
        body: text,
      })
      .run();

    const id = Number(result.lastInsertRowid);
    const row = d
      .select({
        id: chatMessages.id,
        userId: chatMessages.userId,
        username: chatMessages.username,
        role: chatMessages.role,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .get();

    try {
      const cutoff = d
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .orderBy(desc(chatMessages.id))
        .limit(1)
        .offset(MAX_MESSAGES - 1)
        .all();
      if (cutoff.length > 0 && cutoff[0].id) {
        d.delete(chatMessages).where(lt(chatMessages.id, cutoff[0].id)).run();
      }
    } catch {
      // ignore
    }

    if (row) {
      emitPanel('chat:message', row);
      dbHelpers.addLog('INFO', 'CHAT', `${sessionUser.username}: ${text.slice(0, 80)}`, JSON.stringify({ id }));
    }

    return { success: true, data: row };
  });

  app.delete('/api/chat/messages/:id', {
    preHandler: [app.auth, requirePermission('chat:delete')],
  }, async (request, reply) => {
    ensureChatTable();
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      reply.code(400);
      return { success: false, error: 'Invalid message id' };
    }

    const sessionUser = getRequestUser(request);
    if (!hasPermission(sessionUser, 'chat:delete') && sessionUser.role !== 'admin') {
      reply.code(403);
      return { success: false, error: 'Insufficient permissions' };
    }

    const d = getDb();
    const existing = d.select().from(chatMessages).where(eq(chatMessages.id, id)).get();
    if (!existing) {
      reply.code(404);
      return { success: false, error: 'Message not found' };
    }

    d.delete(chatMessages).where(eq(chatMessages.id, id)).run();
    emitPanel('chat:delete', { id });
    dbHelpers.addLog('INFO', 'CHAT', `Message #${id} deleted by ${sessionUser.username}`);

    return { success: true, message: 'Message deleted' };
  });
}
