import { API_BASE } from './config.js';

const TOKEN_KEY = 'somiti_token';
const BASE = `${API_BASE}/api/v1`;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = 'GET', body, form, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = new URLSearchParams(form);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network', 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করো।');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* body নেই */ }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      clearToken();
      window.location.hash = '#/login';
    }
    throw new ApiError(res.status, data?.error, data?.message || 'কিছু একটা ভুল হয়েছে', data?.details);
  }
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', form: { username: email, password } }),
  me: () => request('/auth/me'),
  areas: () => request('/areas'),
  members: (params) => request('/members', { params: { limit: 200, ...params } }),
  member: (id) => request(`/members/${id}`),
  balance: (id) => request(`/members/${id}/balance`),
  createMember: (body) => request('/members', { method: 'POST', body }),
  loans: (params) => request('/loans', { params: { limit: 200, ...params } }),
  createLoan: (body) => request('/loans', { method: 'POST', body }),
  due: (params) => request('/installments/due', { params }),
  pay: (id, amount) => request(`/installments/${id}/pay`, { method: 'POST', body: { amount } }),
  groups: () => request('/gata/groups'),
  groupStatus: (id) => request(`/gata/groups/${id}/status`),
  gataPay: (id, member_id, round_number) =>
    request(`/gata/groups/${id}/payments`, { method: 'POST', body: { member_id, round_number } }),
  payout: (id) => request(`/gata/groups/${id}/payout`, { method: 'POST' }),
  chat: (messages) => request('/chat', { method: 'POST', body: { messages } }),
};
