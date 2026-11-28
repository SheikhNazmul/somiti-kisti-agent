// Short-lived cache of lookup lists (areas, members, loans) so screens can
// show names next to IDs. Everything here is straight from the API.
import { api } from './api.js';

const TTL = 60 * 1000;
const cache = new Map(); // key -> { at, promise }

function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = loader().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

export function invalidate(...keys) {
  if (!keys.length) { cache.clear(); return; }
  keys.forEach((k) => cache.delete(k));
}

export const getAreas = () => cached('areas', () => api.areas.list());
export const getAllMembers = () => cached('members', () => api.members.listAll());
export const getAllLoans = () => cached('loans', () => api.loans.listAll());

export function byId(list) {
  const m = new Map();
  (list || []).forEach((x) => m.set(x.id, x));
  return m;
}

/**
 * Due installments enriched with loan + member + area, for visit lists.
 * Returns [{ inst, loan, member, area }]
 */
export async function getDueEnriched(params) {
  let [due, loans, members, areas] = await Promise.all([
    api.installments.due(params),
    getAllLoans(),
    getAllMembers(),
    getAreas(),
  ]);
  // A loan created moments ago may not be in the cached list yet: refresh once.
  const known = new Set((loans || []).map((l) => l.id));
  if ((due || []).some((i) => !known.has(i.loan_id))) {
    invalidate('loans', 'members');
    [loans, members] = await Promise.all([getAllLoans(), getAllMembers()]);
  }
  const loanMap = byId(loans);
  const memberMap = byId(members);
  const areaMap = byId(areas);
  return (due || []).map((inst) => {
    const loan = loanMap.get(inst.loan_id) || null;
    const member = loan ? memberMap.get(loan.member_id) || null : null;
    const area = member ? areaMap.get(member.area_id) || null : null;
    return { inst, loan, member, area };
  });
}
