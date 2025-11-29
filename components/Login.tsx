
import React, { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const ADMIN_EMAIL = 'gustavo_benvindo80@hotmail.com';

    try {
      // 1. Tentar Login normal
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // LÓGICA DE ADMINISTRAÇÃO:
        // Se for o seu email específico e der erro (provavelmente "Invalid login credentials" pq não existe),
        // tentamos criar a conta automaticamente nos bastidores.
        if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            console.log("Tentando provisionar admin...");
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (!signUpError && signUpData.session) {
                // Sucesso ao criar e já veio a sessão (login automático)
                onLogin();
                return;
            } else if (!signUpError && !signUpData.session) {
                // Sucesso ao criar, mas requer confirmação de email (depende da config do Supabase)
                setError('Conta de administrador criada! Se necessário, verifique seu e-mail para confirmar o cadastro antes de entrar.');
                return;
            }
        }
        
        // Se não for o admin ou se falhar a criação, lança o erro original
        throw signInError;
      }

      // Sucesso no login normal
      onLogin();

    } catch (err: any) {
      console.error(err);
      if (err.message === 'Invalid login credentials') {
         setError('Email ou senha incorretos.');
      } else {
         setError(err.message || 'Erro ao conectar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-ml-yellow p-8 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl font-bold text-ml-blue">F</span>
          </div>
          <h1 className="text-2xl font-bold text-ml-blue">FullStock Control</h1>
          <p className="text-ml-blue/80 font-medium">Acesso Restrito</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full border-gray-300 rounded-lg border p-2.5 focus:ring-ml-blue focus:border-ml-blue transition outline-none bg-gray-50"
                  placeholder="Digite seu email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full border-gray-300 rounded-lg border p-2.5 focus:ring-ml-blue focus:border-ml-blue transition outline-none bg-gray-50"
                  placeholder="Digite sua senha"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-ml-blue hover:bg-[#232766] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ml-blue transition"
            >
              {loading ? 'Verificando...' : 'Acessar Sistema'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-gray-400">
            <p>Sistema exclusivo de gestão.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
