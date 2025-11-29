import React, { useEffect, useState } from 'react';
import { Loader2, XCircle, ArrowLeft } from 'lucide-react';
import { handleAuthCallback } from '../services/mercadolibre';
import { updateUserTokens } from '../services/databaseService';
import { supabase } from '../lib/supabaseClient';

interface AuthCallbackProps {
  onSuccess: () => void;
  onBack: () => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onSuccess, onBack }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      // If no code, maybe user cancelled or url is wrong
      if (!code) {
          setError("Código de autorização não encontrado na URL.");
          return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
           const tokenData = await handleAuthCallback(code, session.user.id);
           await updateUserTokens(
               session.user.id, 
               tokenData.user_id, 
               tokenData.access_token, 
               tokenData.refresh_token
           );
           
           // Clean up URL
           window.history.replaceState({}, document.title, window.location.pathname);
           onSuccess();
        } else {
            setError("Sessão de usuário perdida. Faça login novamente.");
        }
      } catch (err: any) {
        console.error("Auth Error", err);
        setError(err.message || "Erro desconhecido ao processar login.");
      }
    };

    processCallback();
  }, [onSuccess]);

  if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6] p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-red-100">
                <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <XCircle className="text-red-600" size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Falha na Conexão</h2>
                <p className="text-gray-600 mb-6 text-sm">{error}</p>
                
                <button 
                    onClick={onBack}
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-lg hover:bg-black transition"
                >
                    <ArrowLeft size={18} /> Voltar para o Sistema
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6]">
      <Loader2 className="animate-spin text-ml-blue mb-4" size={48} />
      <h2 className="text-xl font-bold text-gray-800">Conectando ao Mercado Livre...</h2>
      <p className="text-gray-500">Estamos trocando chaves de segurança.</p>
    </div>
  );
};

export default AuthCallback;