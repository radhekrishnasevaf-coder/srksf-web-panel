/* ══════════════════════════════════════════════════════════════════════════
   ROLES & PERMISSIONS (pure helpers — koi Firebase import nahi)
   ------------------------------------------------------------------------
   Do role hain:

     super_admin — sab kuch. Team members bana/hata sakta hai aur unke
                   permissions set kar sakta hai. Isko permissions check
                   karne ki zaroorat nahi — hamesha allowed.

     admin       — sirf wahi kar sakta hai jo super admin ne allow kiya ho.
                   Har screen par 4 actions: view / create / edit / delete.

   Team member doc (super admin ke tree me):
     users/{ownerUid}/teamMembers/{authUid}
       ├─ uid, email, displayName, phone
       ├─ role: 'admin'
       ├─ ownerUid: <super admin ka uid>   ← data isi tree ka dikhega
       ├─ status: 'active' | 'inactive'
       └─ permissions: { members: {view,create,edit,delete}, agents: {...}, ... }

   Login karne wale ka apna doc bhi banta hai (users/{authUid}) taaki
   AuthProvider use padh sake aur ownerUid resolve kar sake.
   ══════════════════════════════════════════════════════════════════════════ */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
};

export const ROLE_LABEL = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
};

/** Sabhi actions jo control kiye ja sakte hain */
export const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  EXPORT: 'export',     // PDF / CSV / print
  DOWNLOAD: 'download', // certificate download
  BLOCK: 'block',       // member/agent block-unblock, active-inactive
  APPROVE: 'approve',   // request accept
  REJECT: 'reject',     // request reject
};

export const ACTION_LIST = [
  ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE,
  ACTIONS.EXPORT, ACTIONS.DOWNLOAD, ACTIONS.BLOCK,
  ACTIONS.APPROVE, ACTIONS.REJECT,
];

export const ACTION_LABEL = {
  [ACTIONS.VIEW]: 'View',
  [ACTIONS.CREATE]: 'Create',
  [ACTIONS.EDIT]: 'Edit',
  [ACTIONS.DELETE]: 'Delete',
  [ACTIONS.EXPORT]: 'Export',
  [ACTIONS.DOWNLOAD]: 'Download',
  [ACTIONS.BLOCK]: 'Block',
  [ACTIONS.APPROVE]: 'Approve',
  [ACTIONS.REJECT]: 'Reject',
};

export const ACTION_HINT = {
  [ACTIONS.VIEW]: 'Screen khol kar dekh sakta hai',
  [ACTIONS.CREATE]: 'Naya record bana sakta hai',
  [ACTIONS.EDIT]: 'Maujooda record badal sakta hai',
  [ACTIONS.DELETE]: 'Record hata sakta hai',
  [ACTIONS.EXPORT]: 'PDF / CSV export aur print kar sakta hai',
  [ACTIONS.DOWNLOAD]: 'Certificate download kar sakta hai',
  [ACTIONS.BLOCK]: 'Block / unblock ya active-inactive kar sakta hai',
  [ACTIONS.APPROVE]: 'Request accept kar sakta hai',
  [ACTIONS.REJECT]: 'Request reject kar sakta hai',
};

/**
 * App ki screens. `key` permissions object me use hoti hai,
 * `path` sidebar/route guard ke liye.
 *
 * Nayi screen add karni ho toh bas yahan ek entry daal dijiye —
 * Team Members ka permission matrix apne aap update ho jayega.
 */
const A = ACTIONS;

export const SCREENS = [
  {
    key: 'dashboard', label: 'Dashboard', path: '/', hi: 'डैशबोर्ड',
    actions: [A.VIEW, A.EXPORT],
  },
  {
    // Sidebar me nahi — TopBar ke bell/request icon se khulta hai
    key: 'requests', label: 'Requests', path: null, hi: 'सदस्य अनुरोध',
    actions: [A.VIEW, A.APPROVE, A.REJECT],
  },
  {
    key: 'members', label: 'Members', path: '/members', hi: 'सदस्य',
    actions: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.EXPORT, A.DOWNLOAD, A.BLOCK],
  },
  {
    key: 'agents', label: 'Agents', path: '/agents', hi: 'एजेंट',
    actions: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.EXPORT, A.BLOCK],
  },
  {
    key: 'yojna', label: 'Yojna', path: '/yojna', hi: 'योजना',
    actions: [A.VIEW, A.CREATE, A.EDIT, A.DELETE],
  },
  {
    key: 'closingPayments', label: 'Closing Payments', path: '/closingPayments', hi: 'क्लोजिंग पेमेंट',
    actions: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.EXPORT],
  },
  {
    key: 'transactions', label: 'Payments', path: '/transactions', hi: 'पेमेंट',
    actions: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.EXPORT],
  },
  {
    key: 'commissions', label: 'Commissions', path: '/commissions', hi: 'कमीशन',
    actions: [A.VIEW, A.CREATE, A.EDIT, A.DELETE, A.EXPORT],
  },
  {
    key: 'settings', label: 'Settings', path: '/setting', hi: 'सेटिंग्स',
    actions: [A.VIEW, A.EDIT],
  },
];

/** Is screen par kaunse actions lagu hote hain (matrix me baaki par dash) */
export const actionsForScreen = (screenKey) =>
  getScreen(screenKey)?.actions || [ACTIONS.VIEW];

/** Ye action is screen par lagu hota hai? */
export const actionApplies = (screenKey, action) =>
  actionsForScreen(screenKey).includes(action);

export const SCREEN_KEYS = SCREENS.map((s) => s.key);

export const getScreen = (key) => SCREENS.find((s) => s.key === key) || null;

/** Path se screen dhoondta hai (sabse lamba match jeetta hai) */
export const screenForPath = (pathname) => {
  if (!pathname) return null;
  if (pathname === '/') return getScreen('dashboard');
  // `requests` jaisi screens ka apna URL nahi hota — unhe chhod do
  const matches = SCREENS.filter((s) => s.path && s.path !== '/' && pathname.startsWith(s.path));
  if (!matches.length) return null;
  return matches.reduce((a, b) => (b.path.length > a.path.length ? b : a));
};

/* ── Permission objects ────────────────────────────────────────────────── */

/** Har screen par uske applicable actions ki value set karta hai */
const buildPermissions = (valueFor) =>
  SCREENS.reduce((acc, screen) => {
    acc[screen.key] = screen.actions.reduce((row, action) => {
      row[action] = valueFor(action, screen);
      return row;
    }, {});
    return acc;
  }, {});

/** Har screen par sab false — naya admin banate waqt ka starting point */
export const emptyPermissions = () => buildPermissions(() => false);

/** Har screen par sab true */
export const fullPermissions = () => buildPermissions(() => true);

/** Sirf dekhne ka access — har screen view-only */
export const viewOnlyPermissions = () =>
  buildPermissions((action) => action === ACTIONS.VIEW);

/**
 * Adhoore ya purane permission object ko poora karta hai — nayi screens
 * add hone par bhi crash nahi hota.
 */
export const normalizePermissions = (permissions) => {
  const base = emptyPermissions();
  if (!permissions || typeof permissions !== 'object') return base;
  for (const screen of SCREENS) {
    const p = permissions[screen.key];
    if (!p || typeof p !== 'object') continue;
    // Sirf wahi actions jo is screen par lagu hote hain — junk keys ignore
    base[screen.key] = screen.actions.reduce((row, action) => {
      row[action] = p[action] === true;
      return row;
    }, {});
  }
  return base;
};

/* ── Checks ────────────────────────────────────────────────────────────── */

export const isSuperAdmin = (user) => user?.role === ROLES.SUPER_ADMIN;

/** Account band toh kar diya gaya? */
export const isActiveUser = (user) => !!user && user.status !== 'inactive' && user.delete_flag !== true;

/**
 * Kya ye user is screen par ye action kar sakta hai?
 *
 *   can(user, 'members', 'edit')
 *
 * - Super admin: hamesha true
 * - Inactive user: hamesha false
 * - Admin: uske permissions object se
 *
 * Note: create/edit/delete ke liye us screen ka `view` bhi hona chahiye —
 * warna aisa admin ban jata hai jo edit toh kar sakta hai par screen hi
 * nahi khol sakta.
 */
export const can = (user, screenKey, action = ACTIONS.VIEW) => {
  if (!user) return false;
  if (!isActiveUser(user)) return false;

  // Action is screen par lagu hi nahi hota (jaise dashboard par delete)
  if (!actionApplies(screenKey, action)) return false;

  if (isSuperAdmin(user)) return true;

  const perms = normalizePermissions(user.permissions);
  const screen = perms[screenKey];
  if (!screen) return false;

  if (action === ACTIONS.VIEW) return screen.view === true;
  return screen.view === true && screen[action] === true;
};

/** Kya ye user ye screen khol sakta hai? */
export const canViewScreen = (user, screenKey) => can(user, screenKey, ACTIONS.VIEW);

/** Jo screens ye user dekh sakta hai (path-less bhi, jaise `requests`) */
export const allowedScreens = (user) => SCREENS.filter((s) => canViewScreen(user, s.key));

/**
 * Sirf wo allowed screens jinka apna URL hai — navigation ke liye.
 * `requests` jaisi screens TopBar se khulti hain, unka path nahi hota,
 * isliye unhe yahan se bahar rakha jata hai (warna router.push(null)).
 */
export const navigableScreens = (user) => allowedScreens(user).filter((s) => !!s.path);

/** Login ke baad kahan bhejein — pehli navigable screen */
export const landingPath = (user) => {
  if (canViewScreen(user, 'dashboard')) return '/';
  const first = navigableScreens(user)[0];
  return first ? first.path : '/no-access';
};

/** Ek screen ke kitne actions on hain — matrix me summary dikhane ke liye */
export const countAllowed = (permissions, screenKey) => {
  const p = normalizePermissions(permissions)[screenKey] || {};
  return actionsForScreen(screenKey).filter((a) => p[a] === true).length;
};

/** Kul kitne actions on hain (sab screens milakar) */
export const countAllAllowed = (permissions) => {
  const p = normalizePermissions(permissions);
  return SCREENS.reduce(
    (sum, s) => sum + s.actions.filter((a) => p[s.key]?.[a] === true).length,
    0
  );
};

/** Total kitne actions configure kiye ja sakte hain */
export const totalConfigurableActions = () =>
  SCREENS.reduce((sum, s) => sum + s.actions.length, 0);
