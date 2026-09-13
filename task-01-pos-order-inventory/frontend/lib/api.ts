let inMemoryAccessToken: string | null = null;
let onAuthFailedCallback: (() => void) | null = null;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function setOnAuthFailed(callback: () => void) {
  onAuthFailedCallback = callback;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit & { _isRetry?: boolean } = {}
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (inMemoryAccessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Sends HttpOnly refreshToken cookie automatically
  };

  try {
    const res = await fetch(url, fetchOptions);

    // If 401 and not a login/refresh request, attempt refresh & retry ONCE (Section 13.8)
    if (
      res.status === 401 &&
      !endpoint.endsWith('/api/auth/login') &&
      !endpoint.endsWith('/api/auth/refresh') &&
      !options._isRetry
    ) {
      const refreshSuccess = await refreshToken();
      if (refreshSuccess) {
        // Retry original request once with new token
        return apiFetch<T>(endpoint, {
          ...options,
          _isRetry: true,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${inMemoryAccessToken}`,
          },
        });
      } else {
        // Refresh failed -> clear auth state and trigger redirect to /login
        setAccessToken(null);
        if (onAuthFailedCallback) {
          onAuthFailedCallback();
        }
      }
    }

    let json: any = null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      json = await res.json();
    }

    return {
      ok: res.ok,
      status: res.status,
      data: json as T,
    };
  } catch (err) {
    throw err;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Refreshes access token via HttpOnly refresh cookie or localStorage fallback POST /api/auth/refresh
 */
export async function refreshToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const storedRefreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

      const fetchOptions: RequestInit = {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      };

      if (storedRefreshToken) {
        fetchOptions.body = JSON.stringify({ refreshToken: storedRefreshToken });
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, fetchOptions);

      if (!res.ok) {
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshToken');
        }
        return false;
      }

      const data = await res.json();
      if (data?.data?.accessToken) {
        setAccessToken(data.data.accessToken);
        if (data?.data?.refreshToken && typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        return true;
      }

      setAccessToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refreshToken');
      }
      return false;
    } catch {
      setAccessToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refreshToken');
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
