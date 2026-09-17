"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { message } from "antd";
import {
  ROLES,
  can as canDo,
  canViewScreen,
  isSuperAdmin,
  isActiveUser,
  normalizePermissions,
  fullPermissions,
} from "./permissions";

const AuthContext = createContext();

/* ══════════════════════════════════════════════════════════════════════════
   IMPORTANT — `user.uid` ka matlab
   ------------------------------------------------------------------------
   Poore app me data path aise bante hain: users/{user.uid}/programs/...

   Multi-user support ke liye hum `user.uid` ko **data owner ka uid** rakhte
   hain, logged-in vyakti ka nahi:

     super_admin  → uid = apna hi uid
     admin        → uid = apne super admin ka uid (ownerUid)

   Isse admin login kare toh usko super admin ka hi data dikhta hai, aur
   app ki 180+ purani lines bina badle kaam karti rehti hain.

   Jahan *vyakti* ki pehchaan chahiye (kisne banaya, kisne download kiya),
   wahan `user.authUid` aur `user.displayName` use kijiye — `user.uid` nahi.
   ══════════════════════════════════════════════════════════════════════════ */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const buildUser = useCallback(async (firebaseUser) => {
    const authUid = firebaseUser.uid;

    // Firebase Auth se login ho chuka hai. Agar Firestore read fail ho jaye
    // (rules ya network), toh user ko LOGOUT nahi karna — warna login karke
    // wapas login page par phenk diya jata hai aur wajah pata nahi chalti.
    let snap;
    try {
      snap = await getDoc(doc(db, "users", authUid));
    } catch (err) {
      console.error("[auth] users/{uid} doc read failed:", err);
      return {
        uid: authUid,
        authUid,
        ownerUid: authUid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.email || "User",
        role: ROLES.ADMIN,
        status: "active",
        permissions: normalizePermissions(null),
        tokens: firebaseUser?.stsTokenManager,
        // UI isse pata karke saaf error dikhata hai
        profileError: err?.code === "permission-denied"
          ? "permission-denied"
          : "read-failed",
      };
    }

    // Firestore me doc hi nahi — pehli baar login kar raha hai.
    // Isko super admin maan lo (existing single-admin setup isi se chalta rehta hai).
    if (!snap.exists()) {
      const bootstrap = {
        uid: authUid,
        authUid,
        ownerUid: authUid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || firebaseUser.email || "Admin",
        role: ROLES.SUPER_ADMIN,
        status: "active",
        permissions: fullPermissions(),
        createdAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, "users", authUid), bootstrap, { merge: true });
      } catch (err) {
        console.error("[auth] bootstrap user doc failed:", err);
      }
      return { ...bootstrap, tokens: firebaseUser?.stsTokenManager };
    }

    const data = snap.data();

    // Purane accounts me role nahi hai — unhe super admin maano, warna
    // maujooda admin apne hi panel se bahar ho jayega.
    const role = data.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.SUPER_ADMIN;
    const ownerUid = role === ROLES.ADMIN ? (data.ownerUid || authUid) : authUid;

    let permissions;
    let teamError = null;
    let status = data.status || "active";
    let displayName = data.displayName || data.name || firebaseUser.email || "User";

    if (role === ROLES.SUPER_ADMIN) {
      permissions = fullPermissions();
    } else {
      // Admin ke live permissions hamesha owner ke team doc se aate hain —
      // taaki super admin change kare toh agle login par lag jaye, aur
      // admin apne user doc se khud ko access na de sake.
      try {
        const teamSnap = await getDoc(doc(db, "users", ownerUid, "teamMembers", authUid));
        if (teamSnap.exists()) {
          const t = teamSnap.data();
          permissions = normalizePermissions(t.permissions);
          status = t.status || status;
          displayName = t.displayName || displayName;
        } else {
          // Team se hata diya gaya — ya teamMembers doc bana hi nahi
          permissions = normalizePermissions(null);
          status = "inactive";
          teamError = "not-in-team";
        }
      } catch (err) {
        console.error("[auth] team member doc read failed:", err);
        permissions = normalizePermissions(null);
        status = "inactive";
        teamError = err?.code === "permission-denied" ? "permission-denied" : "read-failed";
      }
    }

    return {
      ...data,
      tokens: firebaseUser?.stsTokenManager,
      // data root — poora app isi ko use karta hai
      uid: ownerUid,
      // asli logged-in vyakti
      authUid,
      ownerUid,
      email: data.email || firebaseUser.email || "",
      displayName,
      role,
      status,
      permissions,
      teamError,
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(await buildUser(firebaseUser));
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        messageApi.error("Failed to load user data");
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [messageApi, buildUser]);

  /** Permissions turant refresh karne ke liye (super admin ne badle hon toh) */
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      setUser(await buildUser(auth.currentUser));
    } catch (err) {
      console.error("[auth] refresh failed:", err);
    }
  }, [buildUser]);

  const value = {
    user,
    loading,
    messageApi,
    refreshUser,
    // Convenience helpers — components me seedha use kar sakte hain
    can: (screenKey, action) => canDo(user, screenKey, action),
    canView: (screenKey) => canViewScreen(user, screenKey),
    isSuperAdmin: isSuperAdmin(user),
    isActive: isActiveUser(user),
  };

  return (
    <AuthContext.Provider value={value}>
      {contextHolder}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
