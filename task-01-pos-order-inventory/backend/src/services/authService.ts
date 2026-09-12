import { userRepository, type SafeUser } from '../repositories/userRepository.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { comparePassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../utils/tokens.js';
import { UnauthorizedError, NotFoundError } from '../utils/errors.js';
import type { LoginInput } from '../validators/index.js';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export const authService = {
  async login(input: LoginInput): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
    });

    const { rawToken, tokenHash } = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await refreshTokenRepository.createToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken: rawToken,
    };
  },

  async refresh(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedError('Refresh token is required');
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const existingToken = await refreshTokenRepository.findByHash(tokenHash);

    if (!existingToken) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (existingToken.revokedAt !== null) {
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    // Refresh Token Rotation: Revoke presented token immediately
    await refreshTokenRepository.revokeToken(existingToken.id);

    const user = await userRepository.findByIdSafe(existingToken.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const newAccessToken = signAccessToken({
      userId: user.id,
      role: user.role,
    });

    const { rawToken: newRawToken, tokenHash: newTokenHash } = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await refreshTokenRepository.createToken({
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawToken,
    };
  },

  async logout(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const token = await refreshTokenRepository.findByHash(tokenHash);
    if (token && !token.revokedAt) {
      await refreshTokenRepository.revokeToken(token.id);
    }
  },

  async getMe(userId: string): Promise<SafeUser> {
    const user = await userRepository.findByIdSafe(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  },
};
