import React, { useEffect, useState } from 'react';
import { Loader2, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { handleAuthCallback } from '../services/mercadolibre';
import { updateUserTokens } from '../services/databaseService';
import { supabase } from '../lib/supabaseClient';

interface AuthCallbackProps {
  onSuccess: () => void;
  onBack: () => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onSuccess, onBack }) => {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Processando login...');

  useEffect(() => {
    let mounted = true;

    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const apiError = params.get('error');
      const errorDesc = params.get('error_description');

      // 1. Check for API Errors returned in URL
      if (apiError) {
          if (mounted) setError(`Erro do ML: ${errorDesc || apiError}`);
          return;
      }

      // 2. Check for Code
      if (!code) {
          if (mounted) setError("Código de autorização não encontrado na URL.");
          return;
      }

      try {
        if (mounted) setStatus('Identificando usuário...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
           if (mounted) setStatus('Trocando chaves de segurança (PKCE)...');
           
           // Perform the real token exchange
           const tokenData = await handleAuthCallback(code, session.user.id);
           
           if (mounted) setStatus('Salvando credenciais...');
           await updateUserTokens(
               session.user.id, 
               tokenData.user_id, 
               tokenData.access_token, 
               tokenData.refresh_token
           );
           
           if (mounted) {
               setStatus('Concluído!');
               // Clean up URL and notify parent
               onSuccess();
           }
        } else {
            if (mounted) setError("Sessão de usuário perdida. Faça login novamente.");
        }
      } catch (err: any) {
        console.error("Auth Error", err);
        if (mounted) setError(err.message || "Erro desconhecido ao processar login.");
      }
    };

    processCallback();

    return () => { mounted = false; };
  }, [onSuccess]);

  if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6] p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-red-100">
                <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <XCircle className="text-red-600" size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Falha na Conexão</h2>
                <p className="text-gray-600 mb-6 text-sm whitespace-pre-wrap">{error}</p>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition"
                    >
                        <RefreshCw size={18} /> Tentar Novamente
                    </button>
                    <button 
                        onClick={onBack}
                        className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-lg hover:bg-black transition"
                    >
                        <ArrowLeft size={18} /> Voltar para Configurações
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6]">
      <div className="bg-white p-8 rounded-xl shadow-sm text-center">
          <Loader2 className="animate-spin text-ml-blue mb-4 mx-auto" size={48} />
          <h2 className="text-xl font-bold text-gray-800">Conectando ao Mercado Livre</h2>
          <p className="text-gray-500 mt-2">{status}</p>
      </div>
    </div>
  );
};

export default AuthCallback;