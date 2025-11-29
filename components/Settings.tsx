
import React, { useState } from 'react';
import { UserSettings } from '../types';
import { Save, ExternalLink, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { getAuthUrl } from '../services/mercadolibre';

interface SettingsProps {
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSaveSettings }) => {
  const [threshold, setThreshold] = useState(settings.alert_threshold_days);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API call to save to Supabase
    setTimeout(() => {
      onSaveSettings({
        ...settings,
        alert_threshold_days: threshold
      });
      setIsSaving(false);
    }, 800);
  };

  const handleConnect = () => {
    const url = getAuthUrl();
    // In a real app, this redirects. Here we just open in new tab to not lose state
    window.open(url, '_blank');
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
                                ID do Usuário: {settings.ml_user_id || '123456789'}
                                <br />
                                Última sincronização: {settings.last_sync || 'Agora mesmo'}
                            </p>
                            <button className="mt-3 text-sm text-green-700 underline flex items-center gap-1 hover:text-green-900">
                                <RefreshCw size={14}/> Forçar atualização de token
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-gray-400 mt-1" size={20} />
                        <div>
                            <p className="font-bold text-gray-700">Nenhuma conta vinculada</p>
                            <p className="text-sm text-gray-500 mt-1">Conecte sua conta do Mercado Livre para importar estoque Full e vendas automaticamente.</p>
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
      </div>

      {/* Preferences Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Preferências de Alerta</h3>
        
        <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Limiar de Ruptura (Dias)
            </label>
            <p className="text-xs text-gray-500 mb-3">
                O sistema marcará como "Crítico" qualquer produto que tenha estoque estimado para durar menos que este número de dias.
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
