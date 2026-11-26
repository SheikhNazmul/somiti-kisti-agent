import { api, getToken } from './api.js';

let user = null;
export const currentUser = () => user;
export const isAdmin = () => user?.role === 'admin';

export async function loadUser() {
  if (!getToken()) return null;
  user = await api.me();
  return user;
}
export function resetUser() { user = null; }
