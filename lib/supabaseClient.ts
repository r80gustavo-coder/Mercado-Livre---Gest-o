import { createClient } from '@supabase/supabase-js';

// Helper function to safely get environment variables in Vite/Vercel
const getEnvVar = (key: string): string | undefined => {
  // Check process.env (Standard/Polyfilled by Vite config)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Check import.meta.env (Vite native)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return undefined;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Verifica se as chaves existem
export const isSupabaseConfigured = 
  typeof supabaseUrl === 'string' && 
  supabaseUrl.length > 0 && 
  typeof supabaseAnonKey === 'string' && 
  supabaseAnonKey.length > 0;

// Se não existirem, usamos valores fictícios para não quebrar a inicialização do módulo.
// A interface (App.tsx) vai verificar 'isSupabaseConfigured' antes de tentar usar o banco.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key'
);