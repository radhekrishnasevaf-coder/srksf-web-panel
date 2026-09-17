import { NextResponse } from "next/server";
import admin from "../admin";

/* ══════════════════════════════════════════════════════════════════════════
   USER ADMIN API
   ------------------------------------------------------------------------
   Ye route Firebase Auth accounts banata/hataata hai — bahut power hai,
   isliye har request par caller ka ID token verify hota hai.

   Kaun kya kar sakta hai:
     checkEmail      → sabhi (login page par, login se pehle chahiye)
     create agent    → koi bhi active user (admin ya super admin)
     create admin    → sirf super admin
     delete / password of an ADMIN (team member) → sirf super admin
     delete / password of an AGENT               → koi bhi active user

   Target admin hai ya agent — ye caller ke tree me teamMembers doc dekh kar
   tay hota hai, request body par bharosa nahi kiya jata.
   ══════════════════════════════════════════════════════════════════════════ */

const adminAuth = admin.auth();
const adminDb = admin.firestore();

async function getCaller(req) {
  const header = req.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Unauthorized — token missing", status: 401 };

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return { error: "Unauthorized — invalid or expired token", status: 401 };
  }

  const snap = await adminDb.doc(`users/${decoded.uid}`).get();
  const data = snap.exists ? snap.data() : null;

  // Doc na ho toh purana single-admin setup — super admin maano
  const role = data?.role === "admin" ? "admin" : "super_admin";
  const status = data?.status || "active";

  if (status !== "active" || data?.delete_flag === true) {
    return { error: "Aapka account band kar diya gaya hai", status: 403 };
  }

  return {
    uid: decoded.uid,
    role,
    ownerUid: role === "admin" ? data?.ownerUid || decoded.uid : decoded.uid,
    isSuperAdmin: role === "super_admin",
  };
}

/** Target uid caller ke tree ka team member (admin) hai? */
async function targetIsTeamMember(ownerUid, targetUid) {
  if (!ownerUid || !targetUid) return false;
  try {
    const snap = await adminDb.doc(`users/${ownerUid}/teamMembers/${targetUid}`).get();
    return snap.exists;
  } catch {
    return false;
  }
}

export async function POST(req) {
  const body = await req.json();
  const { action, email, password, uid, newPassword, OrgData } = body;

  // ── checkEmail login page par chalta hai, tab token hota hi nahi ──
  if (action === "checkEmail") {
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json({ exists: true });
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        return NextResponse.json({ exists: false });
      }
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  const caller = await getCaller(req);
  if (caller.error) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  try {
    if (action === "create") {
      // Admin banana sirf super admin ka kaam; agent koi bhi bana sakta hai
      if (OrgData?.role === "admin" && !caller.isSuperAdmin) {
        return NextResponse.json(
          { error: "Naya admin sirf super admin bana sakta hai" },
          { status: 403 }
        );
      }

      try {
        await adminAuth.getUserByEmail(email);
        return NextResponse.json(
          { error: "User with this email already exists." },
          { status: 400 }
        );
      } catch (err) {
        if (err.code !== "auth/user-not-found") {
          return NextResponse.json({ error: err.message }, { status: 500 });
        }
      }

      const userRecord = await adminAuth.createUser({ email, password });

      // ownerUid hamesha caller ke tree ka — body se nahi liya jata, warna
      // koi doosre ke data me apna account bana sakta tha
      await adminAuth.setCustomUserClaims(userRecord.uid, {
        ...OrgData,
        ownerUid: caller.ownerUid,
        createdBy: caller.uid,
      });

      return NextResponse.json({ success: true, user: userRecord });
    }

    if (action === "delete" || action === "updatePassword") {
      if (!uid) {
        return NextResponse.json({ error: "uid required" }, { status: 400 });
      }

      // Apne aap ko delete karne se roko
      if (action === "delete" && uid === caller.uid) {
        return NextResponse.json(
          { error: "Aap apna hi account delete nahi kar sakte" },
          { status: 400 }
        );
      }

      // Target admin hai toh sirf super admin haath laga sakta hai
      const isAdminTarget = await targetIsTeamMember(caller.ownerUid, uid);
      if (isAdminTarget && !caller.isSuperAdmin) {
        return NextResponse.json(
          { error: "Admin account sirf super admin manage kar sakta hai" },
          { status: 403 }
        );
      }

      if (action === "delete") {
        await adminAuth.deleteUser(uid);
      } else {
        await adminAuth.updateUser(uid, { password: newPassword });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
