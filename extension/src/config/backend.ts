const DEFAULT_BASE_URL = 'http://localhost:8000';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const normalizedBaseUrl = (rawBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

const apiBaseUrl = normalizedBaseUrl.endsWith('/api')
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api`;

const baseUrl = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : normalizedBaseUrl;

export const BASE_URL = baseUrl;
export const API_BASE_URL = apiBaseUrl;
export const RPC_PROXY_URL = `${apiBaseUrl}/rpc/proxy`;
export const HEALTH_URL = `${baseUrl}/health`;
