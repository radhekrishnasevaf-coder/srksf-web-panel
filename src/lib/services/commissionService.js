/* ══════════════════════════════════════════════════════════════════════════
   AGENT COMMISSION SERVICE (client-side Firestore layer)
   ------------------------------------------------------------------------
   Agent ko do tarah ka commission milta hai:
     1. joinFees  — jab member ki join fees (नामांकन शुल्क) collect hoti hai
     2. closing   — jab member closing/marriage payment karta hai

   Firestore structure
     users/{adminUid}/agents/{agentId}                        → commission config
     users/{adminUid}/agents/{agentId}/commissions/{id}       → earned entries
     users/{adminUid}/agents/{agentId}/commissionPayouts/{id} → paid-out records

   Pure calculation helpers `@/lib/commissionCore` me hain (server bhi wahi use
   karta hai) — yahan se re-export ho rahe hain taaki import ek hi jagah se ho.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  buildCommissionDoc,
  COMMISSION_STATUS,
  toISO,
  toNum,
} from '../commissionCore';

export {
  COMMISSION_SOURCE,
  COMMISSION_STATUS,
  COMMISSION_TYPE,
  DEFAULT_COMMISSION_PERCENT,
  DEFAULT_COMMISSION_CONFIG,
  SOURCE_LABEL,
  toNum,
  fmtMoney,
  toISO,
  getCommissionConfig,
  buildCommissionConfig,
  commissionConfigToFormValues,
  calcCommission,
  calcJoinFeesCommission,
  getMemberJoinFeesOverride,
  buildMemberJoinFeesOverride,
  rateLabel,
  summarizeCommissions,
  buildCommissionDoc,
} from '../commissionCore';

/* ── Paths ─────────────────────────────────────────────────────────────── */

export const commissionsPath = (adminUid, agentId) =>
  `users/${adminUid}/agents/${agentId}/commissions`;

export const payoutsPath = (adminUid, agentId) =>
  `users/${adminUid}/agents/${agentId}/commissionPayouts`;

/* ── Writes ────────────────────────────────────────────────────────────── */

/** Ek commission entry banata hai. Amount 0 ya kam ho toh kuch nahi likhta. */
export const createCommissionEntry = async (adminUid, agentId, entry) => {
  if (!adminUid || !agentId) throw new Error('adminUid and agentId are required');
  if (toNum(entry.amount) <= 0) return null;

  const ref = await addDoc(
    collection(db, commissionsPath(adminUid, agentId)),
    buildCommissionDoc(adminUid, agentId, entry)
  );
  return ref.id;
};

/**
 * Kai commission entries ek saath (alag-alag agents bhi ho sakte hain).
 * Ek entry fail ho toh baaki chalti rehti hain — payment kabhi fail nahi hota.
 */
export const createCommissionEntries = async (adminUid, entries = []) => {
  const valid = entries.filter((e) => e?.agentId && toNum(e.amount) > 0);
  if (!valid.length) return [];
  const results = [];
  for (const e of valid) {
    try {
      const id = await createCommissionEntry(adminUid, e.agentId, e);
      if (id) results.push({ id, agentId: e.agentId, amount: toNum(e.amount) });
    } catch (err) {
      console.error('[commissionService] entry failed:', err);
    }
  }
  return results;
};

/* ── Reads ─────────────────────────────────────────────────────────────── */

/**
 * Agent ki commission entries — Firestore se hi paymentDate desc me sorted aati hain.
 *
 * NOTE: har equality filter + orderBy('paymentDate') ke liye composite index chahiye.
 * Saare combinations `firestore.indexes.json` me define hain.
 * `delete_flag` jaan-boojh kar client-side filter kiya hai taaki index count na badhe.
 */
export const getAgentCommissions = async (adminUid, agentId, filters = {}) => {
  if (!adminUid || !agentId) return [];
  const constraints = [];
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.sourceType) constraints.push(where('sourceType', '==', filters.sourceType));
  if (filters.programId) constraints.push(where('programId', '==', filters.programId));
  constraints.push(orderBy('paymentDate', 'desc'));

  const snap = await getDocs(
    query(collection(db, commissionsPath(adminUid, agentId)), ...constraints)
  );

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.delete_flag !== true);
};

/** Agent ke payouts — payoutDate desc (single-field index, composite ki zaroorat nahi). */
export const getAgentPayouts = async (adminUid, agentId) => {
  if (!adminUid || !agentId) return [];
  const snap = await getDocs(
    query(collection(db, payoutsPath(adminUid, agentId)), orderBy('payoutDate', 'desc'))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.delete_flag !== true);
};

/* ── Payout ────────────────────────────────────────────────────────────── */

/**
 * Agent ko commission ka paisa dene ka record banata hai aur selected
 * commission entries ko `paid` mark kar deta hai (atomic batch).
 * Firestore batch limit 500 hai, isliye 400 ke chunks me commit hota hai.
 */
export const payAgentCommission = async (adminUid, agentId, payload) => {
  if (!adminUid || !agentId) throw new Error('adminUid and agentId are required');

  const commissionIds = payload.commissionIds || [];
  const amount = toNum(payload.amount);
  if (amount <= 0) throw new Error('Payout amount must be greater than zero');

  const payoutDate = toISO(payload.payoutDate) || new Date().toISOString();
  const payoutNumber = `COM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const payoutRef = doc(collection(db, payoutsPath(adminUid, agentId)));

  const firstBatch = writeBatch(db);
  firstBatch.set(payoutRef, {
    agentId,
    agentName: payload.agentName || '',
    agentCode: payload.agentCode || '',
    payoutNumber,
    amount,
    paymentMode: payload.paymentMode || 'cash',
    transactionId: payload.transactionId || null,
    note: payload.note || '',
    payoutDate,
    commissionIds,
    commissionCount: commissionIds.length,
    status: 'paid',
    createdAt: new Date().toISOString(),
    createdBy: payload.createdBy || adminUid,
    active_flag: true,
    delete_flag: false,
  });

  const markPaid = (batch, cid) =>
    batch.update(doc(db, commissionsPath(adminUid, agentId), cid), {
      status: COMMISSION_STATUS.PAID,
      payoutId: payoutRef.id,
      payoutNumber,
      paidAt: payoutDate,
      updatedAt: new Date().toISOString(),
    });

  const head = commissionIds.slice(0, 400);
  head.forEach((cid) => markPaid(firstBatch, cid));
  await firstBatch.commit();

  for (let i = 400; i < commissionIds.length; i += 400) {
    const b = writeBatch(db);
    commissionIds.slice(i, i + 400).forEach((cid) => markPaid(b, cid));
    await b.commit();
  }

  return { id: payoutRef.id, payoutNumber, amount };
};

/** Ek payout reverse karta hai — uski entries wapas pending ho jati hain. */
export const revertPayout = async (adminUid, agentId, payout) => {
  const ids = payout.commissionIds || [];

  const firstBatch = writeBatch(db);
  firstBatch.update(doc(db, payoutsPath(adminUid, agentId), payout.id), {
    delete_flag: true,
    active_flag: false,
    revertedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const unmark = (batch, cid) =>
    batch.update(doc(db, commissionsPath(adminUid, agentId), cid), {
      status: COMMISSION_STATUS.PENDING,
      payoutId: null,
      payoutNumber: null,
      paidAt: null,
      updatedAt: new Date().toISOString(),
    });

  ids.slice(0, 400).forEach((cid) => unmark(firstBatch, cid));
  await firstBatch.commit();

  for (let i = 400; i < ids.length; i += 400) {
    const b = writeBatch(db);
    ids.slice(i, i + 400).forEach((cid) => unmark(b, cid));
    await b.commit();
  }
};

/* ── Agent fetch helpers ───────────────────────────────────────────────── */

export const fetchAgent = async (adminUid, agentId) => {
  if (!adminUid || !agentId) return null;
  const snap = await getDoc(doc(db, 'users', adminUid, 'agents', agentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const fetchAllAgents = async (adminUid) => {
  if (!adminUid) return [];
  const snap = await getDocs(collection(db, 'users', adminUid, 'agents'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.delete_flags !== true && a.delete_flag !== true);
};
