// API client. Every call goes to /api/v1/... on this same site;
// netlify.toml forwards /api/* to the Render backend.

const BASE = '/api/v1';
const TOKEN_KEY = 'isc_access_token';

let memoryToken = null;
let unauthorizedHandler = () => {};

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
  /** True when the server is asleep / waking (Render free plan) or unreachable. */
  get isWaking() {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY) || memoryToken; } catch { return memoryToken; }
  },
  set(value) {
    memoryToken = value;
    try { localStorage.setItem(TOKEN_KEY, value); } catch { /* private mode */ }
  },
  clear() {
    memoryToken = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Low-level request.
 * opts: method, json, form (object -> x-www-form-urlencoded), params,
 *       timeout (ms), retries (for waking server), auth (send token), redirectOn401
 */
export async function request(path, opts = {}) {
  const {
    method = 'GET',
    json,
    form,
    params,
    timeout = 45000,
    retries = method === 'GET' ? 2 : 0,
    auth = true,
    redirectOn401 = true,
  } = opts;

  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const headers = { Accept: 'application/json' };
  let body;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const token = auth ? tokenStore.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(url.toString(), { method, headers, body, signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries) { attempt += 1; await sleep(3000); continue; }
      throw new ApiError(0, e && e.name === 'AbortError' ? 'timeout' : 'network');
    }
    clearTimeout(timer);

    if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries) {
      attempt += 1;
      await sleep(4000);
      continue;
    }

    if (res.status === 204) return null;

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }

    if (res.status === 401 && auth && redirectOn401) {
      tokenStore.clear();
      unauthorizedHandler();
      throw new ApiError(401, (data && data.message) || 'unauthorized', data);
    }
    if (!res.ok) {
      const msg = (data && (data.message || data.detail)) || res.statusText;
      throw new ApiError(res.status, typeof msg === 'string' ? msg : JSON.stringify(msg), data);
    }
    return data;
  }
}

/** Fetch every page of a list endpoint that supports limit/offset (max 200). */
export async function listAll(path, params = {}) {
  const limit = 200;
  let offset = 0;
  const out = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await request(path, { params: { ...params, limit, offset } });
    const items = Array.isArray(page) ? page : [];
    out.push(...items);
    if (items.length < limit) break;
    offset += limit;
    if (offset > 20000) break; // safety stop
  }
  return out;
}

export const api = {
  health: (timeout = 12000) => request('/health', { auth: false, timeout, retries: 0 }),

  auth: {
    // OAuth2 password form — NOT JSON.
    login: (email, password) => request('/auth/login', {
      method: 'POST',
      auth: false,
      form: { username: email, password },
      timeout: 30000,
    }),
    me: () => request('/auth/me', { retries: 3 }),
  },

  areas: {
    list: () => request('/areas'),
    get: (id) => request(`/areas/${id}`),
    create: (data) => request('/areas', { method: 'POST', json: data }),
    update: (id, data) => request(`/areas/${id}`, { method: 'PATCH', json: data }),
    remove: (id) => request(`/areas/${id}`, { method: 'DELETE' }),
  },

  members: {
    list: (params) => request('/members', { params }),
    listAll: (params) => listAll('/members', params),
    get: (id) => request(`/members/${id}`),
    create: (data) => request('/members', { method: 'POST', json: data }),
    update: (id, data) => request(`/members/${id}`, { method: 'PATCH', json: data }),
    setAccountType: (id, accountType) => request(`/members/${id}/account-type`, { method: 'PATCH', json: { account_type: accountType } }),
    remove: (id) => request(`/members/${id}`, { method: 'DELETE' }),
    balance: (id) => request(`/members/${id}/balance`),
  },

  loans: {
    list: (params) => request('/loans', { params }),
    listAll: (params) => listAll('/loans', params),
    get: (id) => request(`/loans/${id}`),
    create: (data) => request('/loans', { method: 'POST', json: data }),
    setStatus: (id, status) => request(`/loans/${id}/status`, { method: 'PATCH', json: { status } }),
    remove: (id) => request(`/loans/${id}`, { method: 'DELETE' }),
  },

  installments: {
    // date = YYYY-MM-DD: unpaid installments due on or before that date.
    due: (params) => request('/installments/due', { params }),
    pay: (id, amount) => request(`/installments/${id}/pay`, { method: 'POST', json: { amount } }),
  },

  gata: {
    list: (params) => request('/gata/groups', { params }),
    listAll: (params) => listAll('/gata/groups', params),
    get: (id) => request(`/gata/groups/${id}`),
    create: (data) => request('/gata/groups', { method: 'POST', json: data }),
    addMember: (id, memberId) => request(`/gata/groups/${id}/members`, { method: 'POST', json: { member_id: memberId } }),
    start: (id) => request(`/gata/groups/${id}/start`, { method: 'POST' }),
    // Only member + round: the backend records the group's fixed amount itself.
    pay: (id, memberId, roundNumber) => request(`/gata/groups/${id}/payments`, {
      method: 'POST',
      json: { member_id: memberId, round_number: roundNumber },
    }),
    payout: (id) => request(`/gata/groups/${id}/payout`, { method: 'POST', timeout: 45000 }),
    status: (id) => request(`/gata/groups/${id}/status`),
  },

  chat: (messages) => request('/chat', { method: 'POST', json: { messages }, timeout: 120000 }),

  knowledge: {
    search: (query) => request('/knowledge/search', { method: 'POST', json: { query }, timeout: 60000 }),
    ingest: () => request('/knowledge/ingest', { method: 'POST', timeout: 180000 }),
  },
};
