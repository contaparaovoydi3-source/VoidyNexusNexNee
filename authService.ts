import { supabase } from './supabaseClient';
import { AuthError, Session } from '@supabase/supabase-js';

export const handleSignUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

export const handleSignIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const handleSignOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async (): Promise<Session | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};
