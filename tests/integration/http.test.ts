import '../setup-env.js';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler, notFound, requestId } from '@/shared/http.js';
describe('HTTP middleware', () => {
  it('returns request id on 404', async () => {
    const app = express();
    app.use(requestId, notFound, errorHandler);
    const r = await request(app).get('/missing').set('x-request-id', 'test-request');
    expect(r.status).toBe(404);
    expect(r.headers['x-request-id']).toBe('test-request');
    expect(r.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
