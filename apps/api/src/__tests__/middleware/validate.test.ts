/**
 * Validate Middleware Tests
 *
 * Tests request validation middleware using Zod schemas.
 * Tests body, query, and params validation with error formatting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { validate } from '../../middleware/validate.js';
import { errorHandler } from '../../middleware/error.js';

/**
 * Create test Express app with validation middleware
 */
function createTestApp(schema: z.ZodSchema, location: 'body' | 'query' | 'params' = 'body') {
  const app = express();
  app.use(express.json());

  // Mount route with validate middleware
  if (location === 'body') {
    app.post('/test', validate(schema, 'body'), (req: Request, res: Response) => {
      res.json({ success: true, data: req.body });
    });
  } else if (location === 'query') {
    app.get('/test', validate(schema, 'query'), (req: Request, res: Response) => {
      res.json({ success: true, data: req.query });
    });
  } else if (location === 'params') {
    app.get('/test/:id', validate(schema, 'params'), (req: Request, res: Response) => {
      res.json({ success: true, data: req.params });
    });
  }

  app.use(errorHandler);
  return app;
}

describe('validate middleware', () => {
  describe('body validation', () => {
    const bodySchema = z.object({
      email: z.string().email(),
      age: z.number().int().positive(),
      role: z.enum(['user', 'admin']).optional(),
    });

    let app: express.Application;

    beforeEach(() => {
      app = createTestApp(bodySchema, 'body');
    });

    it('passes valid body data to handler', async () => {
      const validBody = {
        email: 'test@example.com',
        age: 25,
        role: 'user',
      };

      const response = await request(app).post('/test').send(validBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: validBody,
      });
    });

    it('replaces body with Zod-parsed/transformed data', async () => {
      const bodyWithExtra = {
        email: 'test@example.com',
        age: 25,
        extraField: 'should be stripped',
      };

      const response = await request(app).post('/test').send(bodyWithExtra);

      expect(response.status).toBe(200);
      expect(response.body.data).not.toHaveProperty('extraField');
      expect(response.body.data).toEqual({
        email: 'test@example.com',
        age: 25,
      });
    });

    it('returns 400 VALIDATION_ERROR for invalid body', async () => {
      const invalidBody = {
        email: 'not-an-email',
        age: -5,
      };

      const response = await request(app).post('/test').send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.message).toBe('Invalid request data');
    });

    it('includes field-level error paths', async () => {
      const invalidBody = {
        email: 'not-an-email',
        age: 'not-a-number',
      };

      const response = await request(app).post('/test').send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'email',
            message: expect.any(String),
          }),
          expect.objectContaining({
            path: 'age',
            message: expect.any(String),
          }),
        ])
      );
    });
  });

  describe('query validation', () => {
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
      search: z.string().min(1).optional(),
    });

    let app: express.Application;

    beforeEach(() => {
      app = createTestApp(querySchema, 'query');
    });

    it('passes valid query params', async () => {
      const response = await request(app)
        .get('/test')
        .query({ limit: '20', offset: '0', search: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('coerces string numbers from query string', async () => {
      const response = await request(app).get('/test').query({ limit: '25', offset: '10' });

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(25);
      expect(response.body.data.offset).toBe(10);
    });

    it('returns 400 for invalid query', async () => {
      const response = await request(app).get('/test').query({ limit: '999' }); // Exceeds max

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('params validation', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    let app: express.Application;

    beforeEach(() => {
      app = createTestApp(paramsSchema, 'params');
    });

    it('passes valid route params', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app).get(`/test/${validUuid}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(validUuid);
    });

    it('returns 400 for invalid params', async () => {
      const invalidId = 'not-a-uuid';

      const response = await request(app).get(`/test/${invalidId}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('error formatting', () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string().min(8),
    });

    let app: express.Application;

    beforeEach(() => {
      app = createTestApp(schema, 'body');
    });

    it('returns code VALIDATION_ERROR', async () => {
      const response = await request(app).post('/test').send({ email: 'bad' });

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns errors array with path and message', async () => {
      const response = await request(app).post('/test').send({
        email: 'not-email',
        password: 'short',
      });

      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
            message: expect.any(String),
          }),
        ])
      );
    });

    it('handles multiple validation errors', async () => {
      const response = await request(app).post('/test').send({
        email: 'invalid',
        password: 'short',
        confirmPassword: 'short',
      });

      expect(response.status).toBe(400);
      expect(response.body.details.errors.length).toBeGreaterThanOrEqual(2);
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'password' }),
        ])
      );
    });

    it('formats nested path correctly', async () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1),
          }),
        }),
      });

      const nestedApp = createTestApp(nestedSchema, 'body');

      const response = await request(nestedApp).post('/test').send({
        user: { profile: { name: '' } },
      });

      expect(response.status).toBe(400);
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'user.profile.name',
          }),
        ])
      );
    });
  });
});
