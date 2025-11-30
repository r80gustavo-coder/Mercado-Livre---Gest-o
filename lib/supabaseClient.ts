import { createClient } from '@supabase/supabase-js';

// Helper function to safely get environment variables in Vite/Vercel
const getEnvVar = (key: string): string | undefined => {
  // 1. Tenta pegar do import.meta.env (Padrão Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // 2. Tenta pegar do process.env (Polyfill ou Node)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

// Tenta ler do ambiente, se não achar, usa a chave fornecida diretamente (Hardcoded fallback for reliability)
const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || 'https://qnjoldrxdtnbzjlbtphu.supabase.co';
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuam9sZHJ4ZHRuYnpqbGJ0cGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDMwMDEsImV4cCI6MjA3OTk3OTAwMX0.-2XPSO6lgMrz5Zmf_iJYQ1aITj2ViBSE31kSBGiuH-I';

// Verifica se as chaves existem (agora sempre será true devido ao fallback)
export const isSupabaseConfigured = 
  typeof supabaseUrl === 'string' && 
  supabaseUrl.length > 0 && 
  typeof supabaseAnonKey === 'string' && 
  supabaseAnonKey.length > 0;

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key'
);