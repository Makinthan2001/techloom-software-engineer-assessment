import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';

function getRefreshTokenFromRequest(req: Request): string | undefined {
  if (req.body?.refreshToken) return req.body.refreshToken;
  if (req.headers['x-refresh-token']) return req.headers['x-refresh-token'] as string;
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc: Record<string, string>, item) => {
      const [key, val] = item.trim().split('=');
      if (key && val) acc[key] = decodeURIComponent(val);
      return acc;
    }, {});
    return cookies['refreshToken'];
  }
  return undefined;
}

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
};

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);

    res.cookie('refreshToken', result.refreshToken, getCookieOptions());

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const refreshHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken = getRefreshTokenFromRequest(req);
    const result = await authService.refresh(rawToken || '');

    res.cookie('refreshToken', result.refreshToken, getCookieOptions());

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const logoutHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken = getRefreshTokenFromRequest(req);
    if (rawToken) {
      await authService.logout(rawToken);
    }

    const { maxAge, ...clearOptions } = getCookieOptions();
    res.clearCookie('refreshToken', clearOptions);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const getMeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};
