import { useAuth } from '../context/AuthContext';
import { environment } from '../environments/environment';

export function useApi() {
  const { getToken } = useAuth();
  const apiUrl = environment.VITE_API_URL || 'http://localhost:8000';

  const apiFetch = async (path: string, opts: RequestInit = {}): Promise<any> => {
    const doFetch = async (forceRefresh = false) => {
      const token = await getToken(forceRefresh);
      const headers: any = {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return window.fetch(`${apiUrl}${path}`, {
        ...opts,
        headers,
      });
    };

    let res = await doFetch(false);

    if (res.status === 401) {
      res = await doFetch(true);
    }

    if (!res.ok) {
      let body: any = {};
      try {
        body = await res.json();
      } catch (e) {}
      throw new Error(body.detail || `API error ${res.status}`);
    }

    if (res.status === 204) return null;

    return res.json();
  };

  return { apiFetch };
}
