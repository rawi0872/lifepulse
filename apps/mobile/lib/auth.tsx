import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({}),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const timeoutMs = 15000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), timeoutMs),
    );
    try {
      const result = (await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      if (result.error) return { error: result.error.message };
      // Use the authoritative session returned directly — do not wait for an event that may have already fired
      if (result.data.session) {
        setSession(result.data.session);
      }
      return {};
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to connect. Try again.";
      return { error: message };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Clear local state immediately so the UI redirects to login
      // without waiting for the onAuthStateChange event to round-trip.
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
