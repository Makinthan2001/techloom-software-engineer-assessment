import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/index.js';
import type { Role } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  role: Role;
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as any,
  });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (!decoded || typeof decoded !== 'object' || !decoded['userId'] || !decoded['role']) {
    throw new Error('Invalid token payload');
  }
  return {
    userId: decoded['userId'] as string,
    role: decoded['role'] as Role,
  };
};

export const hashRefreshToken = (rawToken: string): string => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

export const generateRefreshToken = (): { rawToken: string; tokenHash: string } => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashRefreshToken(rawToken);
  return { rawToken, tokenHash };
};
