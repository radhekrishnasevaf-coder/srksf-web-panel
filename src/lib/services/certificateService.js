/* ══════════════════════════════════════════════════════════════════════════
   CERTIFICATE DOWNLOAD TRACKING
   ------------------------------------------------------------------------
   Member ka certificate kab, kitni baar aur kisne download kiya — ye member
   doc par record hota hai:

     users/{adminUid}/programs/{programId}/members/{memberId}
       ├─ certificateDownloaded          : true/false
       ├─ certificateDownloadCount       : kitni baar download hua
       ├─ certificateFirstDownloadedAt   : pehli baar (ISO)
       ├─ certificateLastDownloadedAt    : aakhri baar (ISO)
       └─ certificateLastDownloadedBy(Name)

   Purane members me ye fields nahi hongi — unhe "download nahi hua" maana
   jayega, jo sahi hai.
   ══════════════════════════════════════════════════════════════════════════ */

import { updateData } from './firebaseService';

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Firestore Timestamp | Date | ISO string → ISO string */
const toISO = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000).toISOString();
  return null;
};

/**
 * Member doc se certificate download ki status nikalta hai.
 * @returns {{downloaded:boolean, count:number, firstAt:string|null,
 *            lastAt:string|null, byName:string}}
 */
export const getCertificateStatus = (member) => {
  const count = toNum(member?.certificateDownloadCount);
  // Purane records me sirf flag ho sakta hai, count nahi
  const downloaded = member?.certificateDownloaded === true || count > 0;
  return {
    downloaded,
    count: downloaded && count === 0 ? 1 : count,
    firstAt: toISO(member?.certificateFirstDownloadedAt),
    lastAt: toISO(member?.certificateLastDownloadedAt),
    byName: member?.certificateLastDownloadedByName || '',
  };
};

export const membersPath = (adminUid, programId) =>
  `/users/${adminUid}/programs/${programId}/members`;

/**
 * Certificate download hone ke baad member par nishan lagata hai.
 * Count har baar badhta hai, pehli download ki date preserve rehti hai.
 *
 * Ye kabhi throw nahi karta — download already ho chuka hota hai, isliye
 * marking fail hone par user ko error dikhane ka koi fayda nahi. Caller
 * return value (true/false) dekh kar warning dikha sakta hai.
 */
export const markCertificateDownloaded = async (adminUid, programId, member, by = {}) => {
  if (!adminUid || !programId || !member?.id) return false;

  const status = getCertificateStatus(member);
  const now = new Date().toISOString();

  try {
    await updateData(membersPath(adminUid, programId), member.id, {
      certificateDownloaded: true,
      certificateDownloadCount: status.count + 1,
      certificateFirstDownloadedAt: status.firstAt || now,
      certificateLastDownloadedAt: now,
      certificateLastDownloadedBy: by.uid || adminUid,
      certificateLastDownloadedByName: by.name || 'Admin',
    });
    return true;
  } catch (err) {
    console.error('[certificateService] mark failed for', member.id, err);
    return false;
  }
};

/**
 * Bulk download ke baad kai members par ek saath nishan lagata hai.
 * @returns {number} kitne members successfully mark hue
 */
export const markManyCertificatesDownloaded = async (adminUid, programId, members = [], by = {}) => {
  const results = await Promise.all(
    members.map((m) => markCertificateDownloaded(adminUid, programId, m, by))
  );
  return results.filter(Boolean).length;
};

/** Blob ko browser me download karwata hai. */
export const triggerBlobDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke turant nahi — kuch browsers download shuru hone se pehle hi
  // URL khatam kar dene par fail ho jate hain
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
