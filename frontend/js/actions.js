// Reusable form dialogs shared by several screens.
import { api } from './api.js';
import { can } from './session.js';
import { getAreas, getAllMembers, invalidate } from './data.js';
import {
  esc, money, fmtDate, todayISO, toNumber, label, options, openModal, toast, LABELS,
} from './ui.js';

/* ------------ collect an installment (POST /installments/{id}/pay) ------------ */
export function collectInstallmentDialog({ inst, member, loan }) {
  const remaining = toNumber(inst.amount_due) - toNumber(inst.amount_paid);
  const body = `
    <div class="mini-stat green">
      <div class="l">${esc(member ? member.full_name : `ঋণ #${inst.loan_id}`)} · কিস্তি নং ${esc(inst.number)}</div>
      <div class="v">${money(remaining)}</div>
      <div class="l">বাকি · নির্ধারিত তারিখ ${fmtDate(inst.due_date)}</div>
    </div>
    <dl class="kv">
      <dt>কিস্তির পরিমাণ</dt><dd>${money(inst.amount_due)}</dd>
      <dt>আগে জমা</dt><dd>${money(inst.amount_paid)}</dd>
      ${loan ? `<dt>ঋণ</dt><dd>#${esc(loan.id)} · ${money(loan.total_payable)}</dd>` : ''}
    </dl>
    <label class="field">
      <span>জমার পরিমাণ (৳)</span>
      <input class="input" name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" max="${remaining}" value="${remaining}" required>
      <small>বাকি টাকার চেয়ে বেশি নেওয়া যাবে না।</small>
    </label>`;
  const m = openModal({
    title: 'কিস্তি আদায়',
    sub: 'টাকা হাতে পেয়ে তারপর নিশ্চিত করুন।',
    body,
    submitText: 'আদায় নিশ্চিত করুন',
    onSubmit: async (fd) => {
      const amount = String(fd.get('amount') || '').trim();
      const res = await api.installments.pay(inst.id, amount);
      toast(`আদায় হয়েছে: ${money(amount)} · মোট জমা ${money(res.amount_paid)}`);
      invalidate('loans');
      return res;
    },
  });
  return m.done;
}

/* ------------ member create / edit ------------ */
export async function memberFormDialog(member = null) {
  const areas = await getAreas();
  const isEdit = Boolean(member);
  if (!areas.length) {
    toast('আগে একটি এলাকা যোগ করুন — সদস্যকে কোনো এলাকায় রাখতে হয়।', 'warn', 5000);
    return null;
  }
  const typeOpts = Object.entries(LABELS.accountType).map(([value, text]) => ({ value, text }));
  const areaOpts = areas.map((a) => ({ value: a.id, text: `${a.name} · ${label('day', a.collection_day)}` }));
  const typeLocked = isEdit && !can.changeAccountType();
  const body = `
    <div class="form-grid">
      <label class="field full"><span>পূর্ণ নাম</span>
        <input class="input" name="full_name" required minlength="3" maxlength="120" value="${esc(member?.full_name || '')}" placeholder="যেমন: রহিমা খাতুন"></label>
      <label class="field"><span>ফোন নম্বর</span>
        <input class="input" name="phone" required minlength="6" maxlength="20" inputmode="tel" value="${esc(member?.phone || '')}" placeholder="01XXXXXXXXX">
        <small>প্রতিটি সদস্যের ফোন নম্বর আলাদা হতে হবে।</small></label>
      <label class="field"><span>NID-এর শেষ ৪ সংখ্যা</span>
        <input class="input" name="nid_last4" required minlength="4" maxlength="4" pattern="[0-9০-৯]{4}" inputmode="numeric" value="${esc(member?.nid_last4 || '')}"></label>
      <label class="field"><span>এলাকা</span>
        <select class="select" name="area_id" required>${options(areaOpts, member?.area_id)}</select></label>
      <label class="field"><span>হিসাবের ধরন</span>
        <select class="select" name="account_type" required ${typeLocked ? 'disabled' : ''}>${options(typeOpts, member?.account_type || 'loan')}</select>
        ${typeLocked ? '<small>হিসাবের ধরন শুধু অ্যাডমিন বদলাতে পারেন।</small>' : ''}</label>
      <label class="field"><span>যোগদানের তারিখ</span>
        <input class="input" type="date" name="joined_on" required value="${esc(member?.joined_on || todayISO())}"></label>
      ${isEdit ? `<label class="check full"><input type="checkbox" name="is_active" ${member.is_active ? 'checked' : ''}> সদস্য সক্রিয় আছেন</label>` : ''}
    </div>`;
  const m = openModal({
    title: isEdit ? 'সদস্যের তথ্য সম্পাদনা' : 'নতুন সদস্য',
    body,
    wide: true,
    submitText: isEdit ? 'পরিবর্তন সংরক্ষণ' : 'সদস্য যোগ করুন',
    onSubmit: async (fd, { setError }) => {
      const bnDigits = '০১২৩৪৫৬৭৮৯';
      const toLatin = (s) => String(s).replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
      const data = {
        full_name: String(fd.get('full_name')).trim(),
        phone: toLatin(String(fd.get('phone')).trim()),
        nid_last4: toLatin(String(fd.get('nid_last4')).trim()),
        area_id: Number(fd.get('area_id')),
        joined_on: String(fd.get('joined_on')),
      };
      try {
        let saved;
        if (!isEdit) {
          saved = await api.members.create({ ...data, account_type: String(fd.get('account_type')) });
          toast(`নতুন সদস্য যোগ হয়েছে: ${saved.full_name}`);
        } else {
          saved = await api.members.update(member.id, { ...data, is_active: fd.get('is_active') === 'on' });
          const newType = fd.get('account_type');
          if (!typeLocked && newType && newType !== member.account_type) {
            saved = await api.members.setAccountType(member.id, String(newType));
          }
          toast('সদস্যের তথ্য হালনাগাদ হয়েছে');
        }
        invalidate('members');
        return saved;
      } catch (err) {
        if (err.status === 409 && /conflicts with existing data/i.test(err.message || '')) {
          setError('এই ফোন নম্বর দিয়ে আগেই একজন সদস্য আছেন। অন্য নম্বর দিন।');
          return false;
        }
        throw err;
      }
    },
  });
  return m.done;
}

/* ------------ area create / edit ------------ */
export function areaFormDialog(area = null) {
  const dayOpts = Object.entries(LABELS.day).map(([value, text]) => ({ value, text }));
  const m = openModal({
    title: area ? 'এলাকা সম্পাদনা' : 'নতুন এলাকা',
    sub: 'প্রতিটি এলাকার একটি নির্দিষ্ট সাপ্তাহিক আদায়ের দিন থাকে।',
    body: `
      <label class="field"><span>এলাকার নাম</span>
        <input class="input" name="name" required minlength="1" maxlength="120" value="${esc(area?.name || '')}"></label>
      <label class="field"><span>সাপ্তাহিক আদায়ের দিন</span>
        <select class="select" name="collection_day" required>${options(dayOpts, area?.collection_day || 'sat')}</select></label>`,
    submitText: area ? 'সংরক্ষণ' : 'এলাকা যোগ করুন',
    onSubmit: async (fd) => {
      const data = { name: String(fd.get('name')).trim(), collection_day: String(fd.get('collection_day')) };
      const saved = area ? await api.areas.update(area.id, data) : await api.areas.create(data);
      invalidate('areas');
      toast(area ? 'এলাকা হালনাগাদ হয়েছে' : `নতুন এলাকা: ${saved.name}`);
      return saved;
    },
  });
  return m.done;
}

/* ------------ new loan (admin) ------------ */
export async function loanFormDialog(presetMemberId = null) {
  const members = (await getAllMembers()).filter((mm) => mm.is_active);
  const opts = members
    .slice()
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'bn'))
    .map((mm) => ({ value: mm.id, text: `${mm.full_name} · ${mm.phone} · ${label('accountType', mm.account_type)}` }));
  if (!opts.length) { toast('কোনো সক্রিয় সদস্য নেই।', 'warn'); return null; }
  const m = openModal({
    title: 'নতুন ঋণ',
    sub: 'মোট পরিশোধ ও কিস্তির হিসাব সার্ভার নিজে করবে।',
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field full"><span>সদস্য</span>
          <select class="select" name="member_id" required>${options(opts, presetMemberId)}</select></label>
        <label class="field"><span>মূল ঋণ (৳)</span>
          <input class="input" type="number" name="principal" min="1" step="0.01" required inputmode="decimal"></label>
        <label class="field"><span>সার্ভিস চার্জ (%)</span>
          <input class="input" type="number" name="service_charge_pct" min="0" max="50" step="0.01" required inputmode="decimal"></label>
        <label class="field"><span>কিস্তির সংখ্যা</span>
          <input class="input" type="number" name="num_installments" min="1" step="1" required inputmode="numeric"></label>
        <label class="field"><span>শুরুর তারিখ</span>
          <input class="input" type="date" name="start_date" required value="${todayISO()}"></label>
      </div>`,
    submitText: 'ঋণ তৈরি করুন',
    onSubmit: async (fd) => {
      const loan = await api.loans.create({
        member_id: Number(fd.get('member_id')),
        principal: String(fd.get('principal')),
        service_charge_pct: String(fd.get('service_charge_pct')),
        num_installments: Number(fd.get('num_installments')),
        start_date: String(fd.get('start_date')),
      });
      invalidate('loans');
      toast(`ঋণ তৈরি হয়েছে: মোট ${money(loan.total_payable)} · প্রতি কিস্তি ${money(loan.installment_amount)}`, 'ok', 6000);
      return loan;
    },
  });
  return m.done;
}

/* ------------ loan status (admin) ------------ */
export function loanStatusDialog(loan) {
  const opts = Object.entries(LABELS.loanStatus).map(([value, text]) => ({ value, text }));
  const m = openModal({
    title: `ঋণ #${loan.id}-এর অবস্থা`,
    body: `<label class="field"><span>অবস্থা</span><select class="select" name="status">${options(opts, loan.status)}</select></label>`,
    submitText: 'হালনাগাদ',
    onSubmit: async (fd) => {
      const res = await api.loans.setStatus(loan.id, String(fd.get('status')));
      invalidate('loans');
      toast('ঋণের অবস্থা হালনাগাদ হয়েছে');
      return res;
    },
  });
  return m.done;
}
