import { api, getToken } from './api.js';

let user = null;
export const currentUser = () => user;
export const isAdmin = () => user?.role === 'admin';
// admin আর manager দুজনেই এলাকা ও সদস্য যোগ বা বদলাতে পারে
export const canManage = () => ['admin', 'manager'].includes(user?.role);
export const ROLE_NAMES = { admin: 'অ্যাডমিন', manager: 'ম্যানেজার', collector: 'কালেক্টর' };

export async function loadUser() {
  if (!getToken()) return null;
  user = await api.me();
  return user;
}
export function resetUser() { user = null; }
