import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { hashPassword } from '../../src/utils/password.js';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';

const request = supertest(app);

describe('Authentication & Authorization Tests (Items 16-25)', () => {
  const testEmail = 'auth_test_user@techloom.ai';
  const testPassword = 'TestPassword@123';
  let userId: string;

  beforeAll(async () => {
    // Clean up prior test user and tokens
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({ where: { email: testEmail } });

    // Seed clean test user
    const passwordHash = await hashPassword(testPassword);
    const user = await prisma.user.create({
      data: {
        name: 'Auth Test User',
        email: testEmail,
        passwordHash,
        role: 'CASHIER',
      },
    });
    userId = user.id;
  });

  it('16. Valid login returns an access token and returns a refresh token', async () => {
    const res = await request.post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.passwordHash).toBeUndefined(); // Never expose passwordHash
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('17. Invalid password is rejected (401), no tokens issued', async () => {
    const res = await request.post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeUndefined();
  });

  it('18. Accessing a protected endpoint without an access token returns 401', async () => {
    const res = await request.get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('19. An expired access token is rejected (401) and does not authorize request', async () => {
    const expiredToken = jwt.sign(
      { userId, role: 'CASHIER' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('20. A valid refresh token successfully issues a new access token', async () => {
    const loginRes = await request.post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    const refreshToken = loginRes.body.data.refreshToken;

    const res = await request.post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('21. An expired refresh token is rejected (401)', async () => {
    const rawToken = 'expired-raw-refresh-token';
    const expiredDate = new Date(Date.now() - 10000);

    const tokensModule = await import('../../src/utils/tokens.js');
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: tokensModule.hashRefreshToken(rawToken),
        expiresAt: expiredDate,
      },
    });

    const res = await request.post('/api/auth/refresh').send({
      refreshToken: rawToken,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('22. A revoked refresh token is rejected (401)', async () => {
    const tokensModule = await import('../../src/utils/tokens.js');
    const { rawToken, tokenHash } = tokensModule.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 100000);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        revokedAt: new Date(),
      },
    });

    const res = await request.post('/api/auth/refresh').send({
      refreshToken: rawToken,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('23 & 24. Rotation & Reuse: After refresh, old token is revoked and reuse is rejected (401)', async () => {
    const loginRes = await request.post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    const oldRefreshToken = loginRes.body.data.refreshToken;

    // First refresh (Rotation)
    const refreshRes = await request.post('/api/auth/refresh').send({
      refreshToken: oldRefreshToken,
    });
    expect(refreshRes.status).toBe(200);

    // Reuse attempt of the rotated old token
    const reuseRes = await request.post('/api/auth/refresh').send({
      refreshToken: oldRefreshToken,
    });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.success).toBe(false);
  });

  it('25. Logout revokes current refresh token; same token cannot be used again', async () => {
    const loginRes = await request.post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    const accessToken = loginRes.body.data.accessToken;
    const refreshToken = loginRes.body.data.refreshToken;

    const logoutRes = await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    // Attempt to use the logged-out refresh token
    const refreshRes = await request.post('/api/auth/refresh').send({
      refreshToken,
    });
    expect(refreshRes.status).toBe(401);
  });
});
