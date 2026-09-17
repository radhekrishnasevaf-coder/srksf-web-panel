/* ══════════════════════════════════════════════════════════════════════════
   COMMISSION CORE — pure helpers (no Firebase import)
   Client components aur server API routes dono isko use karte hain.
   ══════════════════════════════════════════════════════════════════════════ */

export const COMMISSION_SOURCE = {
  JOIN_FEES: 'joinFees',
  CLOSING: 'closing',
};

export const COMMISSION_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
};

export const COMMISSION_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
};

export const DEFAULT_COMMISSION_PERCENT = 5;

export const DEFAULT_COMMISSION_CONFIG = {
  enabled: false,
  joinFees: { enabled: true, type: COMMISSION_TYPE.PERCENTAGE, value: DEFAULT_COMMISSION_PERCENT },
  closing: { enabled: true, type: COMMISSION_TYPE.PERCENTAGE, value: DEFAULT_COMMISSION_PERCENT },
};

export const SOURCE_LABEL = {
  [COMMISSION_SOURCE.JOIN_FEES]: 'Join Fees',
  [COMMISSION_SOURCE.CLOSING]: 'Closing Payment',
};

export const toNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtMoney = (v) => `₹${toNum(v).toLocaleString('en-IN')}`;

/** Firestore Timestamp | Date | ISO string → ISO string */
export const toISO = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000).toISOString();
  return null;
};

/** Agent doc se commission config nikalta hai, missing keys default se bharta hai. */
export const getCommissionConfig = (agent) => {
  const raw = agent?.commission || {};
  return {
    enabled: raw.enabled === true,
    joinFees: {
      enabled: raw.joinFees?.enabled !== false,
      type: raw.joinFees?.type || COMMISSION_TYPE.PERCENTAGE,
      value: raw.joinFees?.value === undefined || raw.joinFees?.value === null
        ? DEFAULT_COMMISSION_PERCENT
        : toNum(raw.joinFees.value),
    },
    closing: {
      enabled: raw.closing?.enabled !== false,
      type: raw.closing?.type || COMMISSION_TYPE.PERCENTAGE,
      value: raw.closing?.value === undefined || raw.closing?.value === null
        ? DEFAULT_COMMISSION_PERCENT
        : toNum(raw.closing.value),
    },
  };
};

/** Form values → agent doc ka `commission` object */
export const buildCommissionConfig = (values = {}) => ({
  enabled: values.commissionEnabled === true,
  joinFees: {
    enabled: values.joinFeesCommissionEnabled !== false,
    type: values.joinFeesCommissionType || COMMISSION_TYPE.PERCENTAGE,
    value: toNum(
      values.joinFeesCommissionValue === undefined || values.joinFeesCommissionValue === null
        ? DEFAULT_COMMISSION_PERCENT
        : values.joinFeesCommissionValue
    ),
  },
  closing: {
    enabled: values.closingCommissionEnabled !== false,
    type: values.closingCommissionType || COMMISSION_TYPE.PERCENTAGE,
    value: toNum(
      values.closingCommissionValue === undefined || values.closingCommissionValue === null
        ? DEFAULT_COMMISSION_PERCENT
        : values.closingCommissionValue
    ),
  },
});

/** Agent doc → Add/Edit agent form ke field values */
export const commissionConfigToFormValues = (agent) => {
  const c = getCommissionConfig(agent);
  return {
    commissionEnabled: c.enabled,
    joinFeesCommissionEnabled: c.joinFees.enabled,
    joinFeesCommissionType: c.joinFees.type,
    joinFeesCommissionValue: c.joinFees.value,
    closingCommissionEnabled: c.closing.enabled,
    closingCommissionType: c.closing.type,
    closingCommissionValue: c.closing.value,
  };
};

/**
 * Ek payment par agent ka commission calculate karta hai.
 * @returns {{amount:number, type:string, rate:number, applicable:boolean, reason?:string}}
 */
export const calcCommission = (agent, sourceType, baseAmount) => {
  const base = toNum(baseAmount);
  const cfg = getCommissionConfig(agent);
  const rule = sourceType === COMMISSION_SOURCE.CLOSING ? cfg.closing : cfg.joinFees;

  if (!agent) return { amount: 0, type: null, rate: 0, applicable: false, reason: 'no-agent' };
  if (!cfg.enabled) return { amount: 0, type: rule.type, rate: rule.value, applicable: false, reason: 'commission-disabled' };
  if (!rule.enabled) return { amount: 0, type: rule.type, rate: rule.value, applicable: false, reason: 'source-disabled' };
  if (base <= 0) return { amount: 0, type: rule.type, rate: rule.value, applicable: false, reason: 'zero-amount' };

  let amount = rule.type === COMMISSION_TYPE.FIXED
    ? toNum(rule.value)
    : (base * toNum(rule.value)) / 100;

  // Commission kabhi bhi base payment se zyada nahi ho sakta
  amount = Math.min(Math.round(amount * 100) / 100, base);

  return { amount, type: rule.type, rate: toNum(rule.value), applicable: amount > 0 };
};

/* ══════════════════════════════════════════════════════════════════════════
   MEMBER-LEVEL OVERRIDE (sirf Join Fees ke liye)
   ------------------------------------------------------------------------
   Member add karte waqt admin us member ke liye agent ka join-fees commission
   alag set kar sakta hai. Maan lijiye agent ki default rate ₹1000 fixed hai,
   lekin is member par sirf ₹500 dena hai — toh member doc par ye save hota hai:

     member.joinFeesCommission = {
       enabled: true,          // false = is member par commission bilkul nahi
       isCustom: true,         // false = agent ki default rate use karo
       type: 'fixed',
       value: 500,
     }

   Jab bhi is member ki join fees collect hogi (member add ke waqt ya baad me
   payment drawer se), yahi override use hoga — agent default nahi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Member doc se join-fees override nikalta hai (na ho toh null). */
export const getMemberJoinFeesOverride = (member) => {
  const raw = member?.joinFeesCommission;
  if (!raw || typeof raw !== 'object') return null;
  return {
    enabled: raw.enabled !== false,
    isCustom: raw.isCustom === true,
    type: raw.type || COMMISSION_TYPE.PERCENTAGE,
    value: toNum(raw.value),
  };
};

/** Form state → member doc ka `joinFeesCommission` object. */
export const buildMemberJoinFeesOverride = ({ enabled, isCustom, type, value }) => ({
  enabled: enabled !== false,
  isCustom: isCustom === true,
  type: type || COMMISSION_TYPE.PERCENTAGE,
  value: toNum(value),
});

/**
 * Member ki join fees par agent ka commission — member override ko respect
 * karta hai. Override na ho toh seedha agent ki default rate par gir jata hai.
 *
 * @param {object} agent      agent doc (commission config ke saath)
 * @param {object} member     member doc (ya override wala plain object)
 * @param {number} baseAmount jitni join fees abhi collect ho rahi hai
 */
export const calcJoinFeesCommission = (agent, member, baseAmount) => {
  const base = toNum(baseAmount);
  const override = getMemberJoinFeesOverride(member);

  // Agent ke level par hi commission band hai — override bhi kuch nahi kar sakta
  const agentCalc = calcCommission(agent, COMMISSION_SOURCE.JOIN_FEES, base);

  if (!override) return { ...agentCalc, isOverride: false };

  // Admin ne is member par commission band kar diya
  if (!override.enabled) {
    return {
      amount: 0,
      type: agentCalc.type,
      rate: agentCalc.rate,
      applicable: false,
      reason: 'member-disabled',
      isOverride: true,
    };
  }

  // Override hai par custom value nahi — agent default hi chalega
  if (!override.isCustom) return { ...agentCalc, isOverride: false };

  // Agent ka commission hi off hai toh override bekaar
  if (!agentCalc.applicable && agentCalc.reason !== 'zero-amount') {
    return { ...agentCalc, isOverride: false };
  }

  let amount = override.type === COMMISSION_TYPE.FIXED
    ? toNum(override.value)
    : (base * toNum(override.value)) / 100;

  amount = Math.min(Math.round(amount * 100) / 100, base);

  return {
    amount,
    type: override.type,
    rate: toNum(override.value),
    applicable: amount > 0,
    isOverride: true,
  };
};

/** Display label: "5%" ya "₹100" */
export const rateLabel = (type, value) =>
  type === COMMISSION_TYPE.FIXED ? fmtMoney(value) : `${toNum(value)}%`;

/** Commission list → { earned, paid, pending, counts } */
export const summarizeCommissions = (commissions = []) =>
  commissions.reduce(
    (acc, c) => {
      const amt = toNum(c.amount);
      acc.earned += amt;
      acc.total += 1;
      if (c.status === COMMISSION_STATUS.PAID) {
        acc.paid += amt;
        acc.paidCount += 1;
      } else {
        acc.pending += amt;
        acc.pendingCount += 1;
      }
      if (c.sourceType === COMMISSION_SOURCE.JOIN_FEES) acc.joinFeesAmount += amt;
      else acc.closingAmount += amt;
      return acc;
    },
    {
      earned: 0, paid: 0, pending: 0,
      total: 0, paidCount: 0, pendingCount: 0,
      joinFeesAmount: 0, closingAmount: 0,
    }
  );

/** Ek commission document ka shape — client aur server dono same banate hain. */
export const buildCommissionDoc = (adminUid, agentId, entry) => ({
  agentId,
  agentName: entry.agentName || '',
  agentCode: entry.agentCode || '',
  programId: entry.programId || null,
  programName: entry.programName || '',
  sourceType: entry.sourceType,
  sourceTransactionId: entry.sourceTransactionId || null,
  sourceCollection: entry.sourceCollection || null,
  memberId: entry.memberId || null,
  memberName: entry.memberName || '',
  memberRegistrationNumber: entry.memberRegistrationNumber || '',
  closingMemberId: entry.closingMemberId || null,
  closingMemberName: entry.closingMemberName || '',
  baseAmount: toNum(entry.baseAmount),
  commissionType: entry.commissionType || COMMISSION_TYPE.PERCENTAGE,
  commissionRate: toNum(entry.commissionRate),
  isCustomAmount: entry.isCustomAmount === true,
  amount: toNum(entry.amount),
  status: COMMISSION_STATUS.PENDING,
  payoutId: null,
  payoutNumber: null,
  paidAt: null,
  paymentDate: toISO(entry.paymentDate) || new Date().toISOString(),
  note: entry.note || '',
  createdAt: new Date().toISOString(),
  createdBy: entry.createdBy || adminUid,
  active_flag: true,
  delete_flag: false,
});
