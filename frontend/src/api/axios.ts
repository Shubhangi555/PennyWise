import axios from 'axios';
import { loadAuth } from '../lib/authStorage';

// Dev: VITE_API_URL unset → '/api' is forwarded to the backend by the Vite proxy (vite.config.ts).
// Prod: set VITE_API_URL to the backend origin, e.g. https://your-backend.onrender.com
// (a trailing "/" or "/api" is tolerated)
const apiOrigin = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '').replace(/\/api$/, '');

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  // Generous: a free-tier backend (e.g. Render) can take 30–60s to wake from sleep
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  const { token } = loadAuth();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Called when the server rejects our token (expired / invalid). AuthProvider registers it.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 from /auth/* is just "wrong password" — only log out for other endpoints
    const isAuthEndpoint = error.config?.url?.startsWith('/auth/');
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isAuthEndpoint) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export default api;
