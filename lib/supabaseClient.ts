
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
