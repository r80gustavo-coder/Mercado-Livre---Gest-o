
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { handleAuthCallback } from '../services/mercadolibre';
import { updateUserTokens } from '../services/databaseService';
import { supabase } from '../lib/supabaseClient';

interface AuthCallbackProps {
  onSuccess: () => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onSuccess }) => {
  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
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
          }
        } catch (error) {
          console.error("Auth Error", error);
        }
      }
      
      // Clean up the URL to remove the code parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      // Trigger success to go back to dashboard
      onSuccess();
    };

    processCallback();
  }, [onSuccess]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6]">
      <Loader2 className="animate-spin text-ml-blue mb-4" size={48} />
      <h2 className="text-xl font-bold text-gray-800">Conectando ao Mercado Livre...</h2>
      <p className="text-gray-500">Estamos finalizando a configuração da sua conta.</p>
    </div>
  );
};

export default AuthCallback;
