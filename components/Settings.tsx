
import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { Save, ExternalLink, AlertTriangle, CheckCircle, RefreshCw, Copy, Info } from 'lucide-react';
import { getAuthUrl, isMockConfiguration, getAppId } from '../services/mercadolibre';
import { updateUserTokens } from '../services/databaseService';
import { supabase } from '../lib/supabaseClient';

interface SettingsProps {
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSaveSettings }) => {
  const [threshold, setThreshold] = useState(settings.alert_threshold_days);
  const [isSaving, setIsSaving] = useState(false);
  const [redirectUri] = useState(window.location.origin.replace(/\/$/, "")); 
  const [appId] = useState(getAppId());

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSaveSettings({
        ...settings,
        alert_threshold_days: threshold
      });
      setIsSaving(false);
    }, 800);
  };

  const handleConnect = async () => {
    if (isMockConfiguration()) {
      // MOCK MODE
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const mockUserId = "123456789";
        const mockToken = "MOCK_TOKEN_" + Date.now();
        await updateUserTokens(session.user.id, mockUserId, mockToken, "MOCK_REFRESH");
        
        onSaveSettings({
            ...settings,
            is_connected_ml: true,
            ml_user_id: mockUserId
        });
        alert("Modo de Simulação Ativado! (App ID não configurado).");
      }
    } else {
      // REAL MODE WITH PKCE
      try {
        // Now getAuthUrl is async because of PKCE hashing
        const url = await getAuthUrl(window.location.origin);
        window.location.href = url;
      } catch (error: any) {
          console.error("Failed to generate Auth URL:", error);
          alert(`Erro ao iniciar conexão: ${error.message}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configurações</h2>

      {/* Integration Status Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          Integração Mercado Livre
          {settings.is_connected_ml ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">Conectado</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200">Desconectado</span>
          )}
        </h3>

        <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className={`p-4 rounded-lg flex-1 w-full ${settings.is_connected_ml ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-200'}`}>
                {settings.is_connected_ml ? (
                    <div className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1" size={20} />
                        <div>
                            <p className="font-bold text-green-900">Conta Sincronizada</p>
                            <p className="text-sm text-green-700 mt-1">
                                ID do Usuário: {settings.ml_user_id || '---'}
                                <br />
                                App ID em uso: {appId || 'Simulação'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-gray-400 mt-1" size={20} />
                        <div>
                            <p className="font-bold text-gray-700">Nenhuma conta vinculada</p>
                            <p className="text-sm text-gray-500 mt-1">Conecte sua conta para importar estoque Full.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0">
                {!settings.is_connected_ml ? (
                    <button 
                        onClick={handleConnect}
                        className="bg-ml-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-[#232766] transition flex items-center gap-2 shadow-md"
                    >
                        Conectar Mercado Livre <ExternalLink size={18} />
                    </button>
                ) : (
                    <button 
                        onClick={() => onSaveSettings({...settings, is_connected_ml: false})}
                        className="border border-red-200 text-red-600 px-6 py-3 rounded-lg font-medium hover:bg-red-50 transition"
                    >
                        Desconectar Conta
                    </button>
                )}
            </div>
        </div>

        {/* Debug / Configuration Info */}
        {!settings.is_connected_ml && !isMockConfiguration() && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
                <div className="flex items-center gap-2 mb-2 border-b border-yellow-200 pb-2">
                    <Info size={16} className="text-yellow-700" />
                    <h4 className="text-sm font-bold text-yellow-800">Debug & Configuração</h4>
                </div>
                
                <div>
                  <p className="text-xs text-yellow-800 font-bold mb-1">
                      1. Redirect URI (Copie e cole no DevCenter do ML):
                  </p>
                  <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white border border-yellow-300 p-2 rounded text-xs text-gray-700 break-all font-mono">
                          {redirectUri}
                      </code>
                      <button 
                          onClick={() => navigator.clipboard.writeText(redirectUri)}
                          className="p-2 text-yellow-700 hover:text-yellow-900 bg-yellow-100 rounded"
                          title="Copiar URL"
                      >
                          <Copy size={16} />
                      </button>
                  </div>
                </div>

                <div>
                   <p className="text-xs text-yellow-800 font-bold mb-1">
                       2. App ID (Do Vercel):
                   </p>
                   <code className="bg-white border border-yellow-300 p-1 px-2 rounded text-xs text-gray-700 font-mono">
                       {appId || "Não detectado"}
                   </code>
                </div>

                <div className="pt-2 border-t border-yellow-200">
                    <p className="text-xs text-red-700 font-bold">
                        ⚠️ Importante: Configure também o <code>NEXT_PUBLIC_ML_CLIENT_SECRET</code> no Vercel para que o login funcione.
                    </p>
                </div>
            </div>
        )}
      </div>

      {/* Preferences Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Preferências de Alerta</h3>
        
        <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Limiar de Ruptura (Dias)
            </label>
            <p className="text-xs text-gray-500 mb-3">
                Alertar quando estoque durar menos que:
            </p>
            
            <div className="flex gap-4">
                <input 
                    type="number" 
                    min="1" 
                    max="30"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-24 rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-ml-blue outline-none"
                />
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition disabled:opacity-50"
                >
                    <Save size={18} />
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
