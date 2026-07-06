import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import * as api from "../utils/api";

export type AppRole = "user" | "admin" | "l1" | "superadmin" | "sme";

interface UserData {
  uid: string;
  email: string;
  state: string;
  role: "user";
  createdAt: Date;
  lastLogin?: Date;
  isActive?: boolean;
}

interface AdminData {
  id: string;
  password: string;
  role: "admin";
}

interface L1Data {
  govtId: string;
  name?: string;
  state?: string;
  district?: string;
  role: "l1";
}

interface SMEData {
  smeId: string;
  name?: string;
  state?: string;
  department?: string;
  role: "sme";
}

interface SuperAdminData {
  id: string;
  role: "superadmin";
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | AdminData | L1Data | SMEData | SuperAdminData | null;
  loading: boolean;
  appRole: AppRole | null;
  signup: (email: string, password: string, state: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  adminLogin: (id: string, password: string) => Promise<void>;
  l1Login: (govtId: string, password: string) => Promise<void>;
  smeLogin: (smeId: string, password: string) => Promise<void>;
  superAdminLogin: (id: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// admin/superadmin have no Firebase session, so persist them ourselves to survive a reload
const NON_FIREBASE_SESSION_KEY = "aquawatch_session";

type StoredSession = { role: "admin" | "superadmin"; id: string };

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(NON_FIREBASE_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

const writeStoredSession = (session: StoredSession | null) => {
  try {
    if (session) localStorage.setItem(NON_FIREBASE_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(NON_FIREBASE_SESSION_KEY);
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};



export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | AdminData | L1Data | SMEData | SuperAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  // Track if we have a non-Firebase session (admin, l1, superadmin, or demo user)
  const isNonFirebaseSession = useRef(false);

  const signup = async (email: string, password: string, state: string) => {
    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Save user data to Firestore in 'users' collection
      const userDoc = {
        uid: user.uid,
        email: user.email!,
        state: state,
        role: "user" as const,
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true,
      };

      // Save to users collection
      await setDoc(doc(db, "users", user.uid), userDoc);

      // Also save user info to the state-specific document in DWLR_state collection
      try {
        const stateDocRef = doc(db, "DWLR_state", state);
        const stateDoc = await getDoc(stateDocRef);

        if (stateDoc.exists()) {
          // If state document exists, add user to users array
          const stateData = stateDoc.data();
          const existingUsers = stateData.users || [];

          const newUser = {
            uid: user.uid,
            email: user.email!,
            joinedAt: new Date(),
            isActive: true,
          };

          await setDoc(
            stateDocRef,
            {
              ...stateData,
              users: [...existingUsers, newUser],
              totalUsers: (stateData.totalUsers || 0) + 1,
              lastUserActivity: new Date(),
            },
            { merge: true }
          );
        } else {
          // Create new state document if it doesn't exist
          await setDoc(stateDocRef, {
            state: state,
            users: [
              {
                uid: user.uid,
                email: user.email!,
                joinedAt: new Date(),
                isActive: true,
              },
            ],
            totalUsers: 1,
            lastUserActivity: new Date(),
            waterLevel: 50, // Default water level
            status: "normal",
            lastUpdated: new Date(),
          });
        }
      } catch (stateError) {
        console.error("Error updating state document:", stateError);
        // Don't throw error here as user creation was successful
      }

      setUserData(userDoc);
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // Get user data from Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as UserData;

        // Update last login time
        const updatedUserData = {
          ...userData,
          lastLogin: new Date(),
          isActive: true,
        };

        // Update user document with last login
        await setDoc(userDocRef, updatedUserData, { merge: true });

        // Update user activity in state document
        try {
          const stateDocRef = doc(db, "DWLR_state", userData.state);
          const stateDoc = await getDoc(stateDocRef);

          if (stateDoc.exists()) {
            const stateData = stateDoc.data();
            const users = stateData.users || [];

            // Update user's last activity in the state's users array
            const updatedUsers = users.map((stateUser: any) =>
              stateUser.uid === user.uid
                ? { ...stateUser, lastActivity: new Date(), isActive: true }
                : stateUser
            );

            await setDoc(
              stateDocRef,
              {
                ...stateData,
                users: updatedUsers,
                lastUserActivity: new Date(),
              },
              { merge: true }
            );
          }
        } catch (stateError) {
          console.error("Error updating state user activity:", stateError);
        }

        setUserData(updatedUserData);
      } else {
        throw new Error("User data not found");
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const adminLogin = async (id: string, password: string) => {
    try {
      await api.adminLogin(id, password);
      isNonFirebaseSession.current = true;
      const adminData: AdminData = { id, password, role: "admin" };
      setUserData(adminData);
      setAppRole("admin");
      (window as any).__aqRole = "admin";
      setCurrentUser({ uid: `admin_${id}`, email: `${id}@aquawatch.admin`, emailVerified: true } as User);
      writeStoredSession({ role: "admin", id });
    } catch (error) {
      console.error("Admin login error:", error);
      throw error;
    }
  };

  const l1Login = async (govtId: string, password: string) => {
    try {
      // Use isNonFirebaseSession=true so onAuthStateChanged doesn't double-set state
      isNonFirebaseSession.current = true;
      const syntheticEmail = `${govtId}@l1.aquawatch.internal`;
      const { user } = await signInWithEmailAndPassword(auth, syntheticEmail, password);
      // Fetch L1 metadata from the backend (Mongo-backed, not Firestore — see backend/main.py's l1_authority_col)
      let l1Meta: Partial<L1Data> = {};
      try {
        const profile = await api.getL1Profile(govtId);
        l1Meta = { name: profile.name, state: profile.assigned_location.state, district: profile.assigned_location.district };
      } catch (_) {}
      const l1Data: L1Data = { govtId, role: "l1", ...l1Meta };
      setCurrentUser(user);
      setUserData(l1Data);
      setAppRole("l1");
      (window as any).__aqRole = "l1";
    } catch (error) {
      isNonFirebaseSession.current = false;
      console.error("L1 login error:", error);
      throw error;
    }
  };

  const smeLogin = async (smeId: string, password: string) => {
    try {
      isNonFirebaseSession.current = true;
      const syntheticEmail = `${smeId}@sme.aquawatch.internal`;
      const { user } = await signInWithEmailAndPassword(auth, syntheticEmail, password);
      // Fetch SME metadata from the backend (Mongo-backed)
      let smeMeta: Partial<SMEData> = {};
      try {
        const profile = await api.getSMEProfile(smeId);
        smeMeta = { name: profile.name, state: profile.state, department: profile.department };
      } catch (_) {}
      const smeData: SMEData = { smeId, role: "sme", ...smeMeta };
      setCurrentUser(user);
      setUserData(smeData);
      setAppRole("sme");
      (window as any).__aqRole = "sme";
    } catch (error) {
      isNonFirebaseSession.current = false;
      console.error("SME login error:", error);
      throw error;
    }
  };

  const superAdminLogin = async (id: string, password: string) => {
    try {
      await api.superAdminLogin(id, password);
      isNonFirebaseSession.current = true;
      const saData: SuperAdminData = { id, role: "superadmin" };
      setUserData(saData);
      setAppRole("superadmin");
      (window as any).__aqRole = "superadmin";
      setCurrentUser({ uid: `superadmin_${id}`, email: `${id}@aquawatch.superadmin`, emailVerified: true } as User);
      writeStoredSession({ role: "superadmin", id });
    } catch (error) {
      console.error("Super admin login error:", error);
      throw error;
    }
  };

  const demoLogin = async () => {
    try {
      isNonFirebaseSession.current = true;
      const demoUserData: UserData = {
        uid: "demo_user_123",
        email: "demo@aquawatch.com",
        state: "Maharashtra",
        role: "user",
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true,
      };
      setUserData(demoUserData);
      setAppRole("user");
      (window as any).__aqRole = "user";
      setCurrentUser({ uid: "demo_user_123", email: "demo@aquawatch.com", emailVerified: true } as User);
      try {
        const userDoc = doc(db, "users", "demo_user_123");
        await setDoc(userDoc, demoUserData);
      } catch (_) {}
    } catch (error) {
      console.error("Demo login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      isNonFirebaseSession.current = false;
      setAppRole(null);
      writeStoredSession(null);
      if (userData?.role === "admin" || userData?.role === "superadmin") {
        setCurrentUser(null);
        setUserData(null);
      } else if (userData && "uid" in userData && (userData as any).uid === "demo_user_123") {
        setCurrentUser(null);
        setUserData(null);
      } else {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  // Restore admin/superadmin session on reload — they have no Firebase session to rely on.
  // ponytail: trusts the stored role/id as-is (backend issues no session token today),
  // matches the existing security model; upgrade to a real verified token if that changes.
  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      isNonFirebaseSession.current = true;
      setUserData(
        stored.role === "admin"
          ? { id: stored.id, password: "", role: "admin" }
          : { id: stored.id, role: "superadmin" }
      );
      setAppRole(stored.role);
      (window as any).__aqRole = stored.role;
      setCurrentUser({
        uid: `${stored.role}_${stored.id}`,
        email: `${stored.id}@aquawatch.${stored.role}`,
        emailVerified: true,
      } as User);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isNonFirebaseSession.current) {
        setLoading(false);
        return;
      }

      if (user) {
        setCurrentUser(user);
        try {
          // Check if it's an L1 user (synthetic email pattern)
          if (user.email?.endsWith("@l1.aquawatch.internal")) {
            const govtId = user.email.replace("@l1.aquawatch.internal", "");
            const l1Data: L1Data = { govtId, role: "l1" };
            setUserData(l1Data);
            setAppRole("l1");
          } else if (user.email?.endsWith("@sme.aquawatch.internal")) {
            const smeId = user.email.replace("@sme.aquawatch.internal", "");
            const smeData: SMEData = { smeId, role: "sme" };
            setUserData(smeData);
            setAppRole("sme");
          } else {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const ud = userDocSnap.data() as UserData;
              setUserData(ud);
              setAppRole("user");
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
        setAppRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    appRole,
    signup,
    login,
    adminLogin,
    l1Login,
    smeLogin,
    superAdminLogin,
    demoLogin,
    logout,
    isAdmin: userData?.role === "admin",
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
