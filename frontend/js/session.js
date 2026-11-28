// Logged-in user and role-based permissions (role comes from GET /auth/me).
import { api, tokenStore } from './api.js';

let currentUser = null;

export const session = {
  get user() { return currentUser; },
  get role() { return currentUser ? currentUser.role : null; },
  isLoggedIn() { return Boolean(tokenStore.get()); },

  async login(email, password) {
    const res = await api.auth.login(email, password);
    if (!res || !res.access_token) throw new Error('no token');
    tokenStore.set(res.access_token);
    currentUser = await api.auth.me();
    return currentUser;
  },

  async loadMe() {
    currentUser = await api.auth.me();
    return currentUser;
  },

  logout() {
    tokenStore.clear();
    currentUser = null;
  },
};

const is = (...roles) => () => Boolean(currentUser && roles.includes(currentUser.role));

/** UI permissions — they mirror the backend's checks so we only show buttons that will work. */
export const can = {
  editMembers: is('admin', 'manager'),     // POST/PATCH /members
  changeAccountType: is('admin'),          // PATCH /members/{id}/account-type
  deleteMembers: is('admin'),              // DELETE /members/{id}
  manageAreas: is('admin', 'manager'),     // POST/PATCH /areas
  deleteAreas: is('admin'),                // DELETE /areas/{id}
  manageLoans: is('admin'),                // POST /loans, PATCH status
  deleteLoans: is('admin'),                // DELETE /loans/{id}
  collect: is('admin', 'manager', 'collector'), // POST /installments/{id}/pay, gata payments
  manageGata: is('admin'),                 // create group, add member, start, payout
  chat: is('admin', 'manager', 'collector'),
  ingest: is('admin'),                     // POST /knowledge/ingest
};
