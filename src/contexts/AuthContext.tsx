import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { fetchMyProfile, signOut as doSignOut, type Profile } from "../lib/auth";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const profileCacheKey = (uid: string) => `profile_cache_${uid}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    try {
      const p = await fetchMyProfile(uid);
      setProfile(p);
      setProfileError(p ? null : "Perfil não encontrado. Contate o administrador.");
      if (p) localStorage.setItem(profileCacheKey(uid), JSON.stringify(p));
    } catch (e) {
      setProfile(null);
      setProfileError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setProfileError("Supabase não configurado.");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      const uid = data.session?.user?.id ?? null;
      if (uid) {
        const cached = localStorage.getItem(profileCacheKey(uid));
        if (cached) {
          try {
            setProfile(JSON.parse(cached) as Profile);
          } catch {
            // Ignore cache parse errors and fetch from source of truth.
          }
        }
      }
      setLoading(false);
      void loadProfile(uid);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      void loadProfile(newSession?.user?.id ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    loading,
    profileError,
    refreshProfile: async () => loadProfile(user?.id ?? null),
    logout: async () => {
      if (user?.id) localStorage.removeItem(profileCacheKey(user.id));
      await doSignOut();
      setProfile(null);
      setProfileError(null);
    },
  }), [user, session, profile, loading, profileError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

