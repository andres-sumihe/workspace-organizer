import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { closeDb } from '../db/client.js';

import type { ErrorPayload, WorkspaceListResponse } from '@workspace/shared';
import type { Express } from 'express';

let app: Express;

beforeEach(async () => {
  await closeDb();
  app = await createApp();
});

describe('GET /api/v1/workspaces', () => {
  it('returns a paginated list of workspaces with default settings', async () => {
    const response = await request(app).get('/api/v1/workspaces').expect(200);
    const payload = response.body as WorkspaceListResponse;

    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);

    expect(payload.meta.page).toBe(1);
    expect(payload.meta.pageSize).toBe(20);
    expect(payload.meta.total).toBeGreaterThan(0);
    expect(typeof payload.meta.hasNextPage).toBe('boolean');
    expect(payload.meta.hasPreviousPage).toBe(false);
  });

  it('supports custom pagination parameters', async () => {
    const response = await request(app)
      .get('/api/v1/workspaces')
      .query({ page: '2', pageSize: '1' })
      .expect(200);
    const payload = response.body as WorkspaceListResponse;

    expect(payload.meta.total).toBe(3);
    expect(payload.meta.page).toBe(2);
    expect(payload.meta.pageSize).toBe(1);
    expect(payload.meta.hasNextPage).toBe(true);
    expect(payload.meta.hasPreviousPage).toBe(true);

    expect(payload.items).toHaveLength(1);
  });

  it('rejects invalid pagination parameters', async () => {
    const response = await request(app)
      .get('/api/v1/workspaces')
      .query({ page: '0', pageSize: '-5' })
      .expect(400);
    const payload = response.body as { error: ErrorPayload };

    expect(payload.error.code).toBe('BAD_REQUEST');
    expect(payload.error.message).toBe('Invalid pagination parameters.');
    expect(Array.isArray(payload.error.details)).toBe(true);

    if (payload.error.details) {
      const fields = payload.error.details.map((detail) => detail.field);
      expect(fields).toContain('page');
      expect(fields).toContain('pageSize');
    }
  });
});
