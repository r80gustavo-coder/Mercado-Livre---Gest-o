import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import FactoryControl from './components/FactoryControl';
import BatchManager from './components/BatchManager';
import Settings from './components/Settings';
import Login from './components/Login';
import AuthCallback from './components/AuthCallback';
import { Product, Batch, ViewState, BatchItem, UserSettings, BatchStatus } from './types';
import { syncMercadoLivreData } from './services/syncService';
import { LogOut, Bell, Loader2, AlertTriangle, Terminal } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import * as db from './services/databaseService';

// --- COMPONENTS FOR SETUP SCREEN ---
const SetupScreen = () => (
  <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
    <div className="max-w-2xl w-full bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      <div className="bg-ml-yellow p-6 flex items-center gap-4">
        <AlertTriangle className="text-ml-blue h-10 w-10" />
        <div>
          <h1 className="text-2xl font-bold text-ml-blue">Configuração Necessária</h1>
          <p className="text-ml-blue font-medium opacity-90">Variáveis de ambiente não detectadas</p>
        </div>
      </div>
      <div className="p-8 space-y-6">
        <p className="text-gray-300">
          O aplicativo não encontrou as chaves de conexão com o Supabase. Para corrigir isso no Vercel ou localmente:
        </p>
        
        <div className="bg-black rounded-lg p-4 font-mono text-sm overflow-x-auto border border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 mb-2 border-b border-gray-800 pb-2">
            <Terminal size={14} /> .env.local / Vercel Environment Variables
          </div>
          <p className="text-green-400">NEXT_PUBLIC_SUPABASE_URL<span className="text-white">=https://seu-projeto.supabase.co</span></p>
          <p className="text-green-400">NEXT_PUBLIC_SUPABASE_ANON_KEY<span className="text-white">=sua-chave-anonima-publica</span></p>
          <p className="text-blue-400">API_KEY<span className="text-white">=(Opcional) Sua chave Google Gemini</span></p>
        </div>

        <div className="space-y-2">
            <h3 className="font-bold text-white">Como resolver no Vercel:</h3>
            <ol className="list-decimal list-inside text-gray-400 space-y-1 ml-2">
                <li>Vá para o Dashboard do seu projeto no Vercel.</li>
                <li>Clique em <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
                <li>Adicione as chaves listadas acima exatamente com esses nomes.</li>
                <li>Faça um novo <strong>Redeploy</strong> (ou push no git) para aplicar.</li>
            </ol>
        </div>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  // 0. Safety Check
  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  const [session, setSession] = useState<any>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [loadingData, setLoadingData] = useState(false);
  
  // App State
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  // User Settings State
  const [userSettings, setUserSettings] = useState<UserSettings>({
    is_connected_ml: false,
    alert_threshold_days: 5,
    last_sync: undefined
  });

  const [notification, setNotification] = useState<string | null>(null);

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // 1. Auth Listener
  useEffect(() => {
    // Check url for OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) {
      setCurrentView(ViewState.CALLBACK);
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (session?.user && currentView !== ViewState.CALLBACK) {
      loadUserData();
    }
  }, [session, currentView]);

  const loadUserData = async () => {
    if (!session?.user?.id) return;
    setLoadingData(true);
    try {
      const [fetchedProducts, fetchedBatches, fetchedSettings] = await Promise.all([
        db.getProducts(session.user.id),
        db.getBatches(session.user.id),
        db.getUserSettings(session.user.id)
      ]);
      setProducts(fetchedProducts);
      setBatches(fetchedBatches);
      setUserSettings(fetchedSettings);
    } catch (error) {
      console.error("Error loading data", error);
      showNotify("Erro ao carregar dados. Verifique sua conexão.");
    } finally {
      setLoadingData(false);
    }
  };

  // Actions
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentView(ViewState.LOGIN);
    setProducts([]);
    setBatches([]);
    setUserSettings({ is_connected_ml: false, alert_threshold_days: 5 });
  };

  const handleSyncML = async () => {
    showNotify('Iniciando sincronização com Mercado Livre...');
    
    const accessToken = userSettings.is_connected_ml ? 'mock_token' : null; 
    const userId = userSettings.ml_user_id;

    if (!userId) {
        showNotify("Erro: ID do usuário ML não encontrado nas configurações.");
        return;
    }

    try {
      const updatedProducts = await syncMercadoLivreData(products, accessToken, userId);
      
      // Update DB for each changed product
      for (const p of updatedProducts) {
         await db.updateProductStock(p.id, { 
             stock_full: p.stock_full 
         });
      }

      await loadUserData();
      showNotify('Sincronização com Mercado Livre concluída!');
    } catch (e) {
      console.error(e);
      showNotify('Erro ao sincronizar. Tente novamente.');
    }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    if (!session?.user?.id) return;
    try {
        await db.updateUserSettings(session.user.id, newSettings);
        setUserSettings(newSettings);
        showNotify('Configurações salvas.');
    } catch (error) {
        showNotify('Erro ao salvar configurações.');
    }
  };

  const handleAddProduct = async (newProductData: Omit<Product, 'id' | 'sales_history' | 'avg_daily_sales' | 'stock_full' | 'stock_scheduled'>) => {
    if (!session?.user?.id) return;
    
    try {
        await db.createProduct(session.user.id, newProductData);
        await loadUserData();
        showNotify('Produto cadastrado com sucesso!');
    } catch (error) {
        console.error(error);
        showNotify('Erro ao criar produto.');
    }
  };

  const handleCreateBatch = async (items: BatchItem[], date: string) => {
    if (!session?.user?.id) return;

    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      if (!product || product.stock_factory < item.quantity) {
        showNotify(`Erro: Estoque insuficiente para ${item.product_title}`);
        return;
      }
    }

    try {
        const totalQty = items.reduce((acc, item) => acc + item.quantity, 0);
        const newBatchData: Partial<Batch> = {
            total_quantity: totalQty,
            status: 'IN_TRANSIT',
            sent_date: date,
            items: items
        };
        await db.createBatch(session.user.id, newBatchData);

        for (const item of items) {
            const product = products.find(p => p.id === item.product_id);
            if (product) {
                await db.updateProductStock(product.id, {
                    stock_factory: product.stock_factory - item.quantity,
                    stock_scheduled: product.stock_scheduled + item.quantity
                });
            }
        }

        await loadUserData();
        showNotify('Envio criado! Estoque atualizado.');
        setCurrentView(ViewState.BATCHES);

    } catch (error) {
        console.error(error);
        showNotify('Erro ao processar envio.');
    }
  };

  const handleReceiveBatch = async (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch || batch.status === 'RECEIVED') return;

    try {
        await db.updateBatchStatus(batchId, 'RECEIVED', new Date().toISOString());

        for (const item of batch.items) {
            const product = products.find(p => p.id === item.product_id);
            if (product) {
                 await db.updateProductStock(product.id, {
                    stock_scheduled: Math.max(0, product.stock_scheduled - item.quantity),
                    stock_full: product.stock_full + item.quantity
                });
            }
        }

        await loadUserData();
        showNotify(`Lote recebido. Estoque Full atualizado!`);
    } catch (error) {
        showNotify('Erro ao receber lote.');
    }
  };

  const handleUpdateFactoryStock = async (productId: string, newStock: number) => {
    try {
        await db.updateProductStock(productId, { stock_factory: newStock });
        setProducts(prev => prev.map(p => 
            p.id === productId ? { ...p, stock_factory: newStock } : p
        ));
        showNotify('Estoque de fábrica atualizado.');
    } catch (error) {
        showNotify('Erro ao atualizar estoque.');
    }
  };

  // View Logic
  if (!session && currentView !== ViewState.CALLBACK) {
    return <Login onLogin={() => {}} />; 
  }

  // Handle Callback View
  if (currentView === ViewState.CALLBACK) {
      return <AuthCallback onSuccess={() => {
          setCurrentView(ViewState.SETTINGS); // or DASHBOARD
          loadUserData();
      }} />;
  }

  if (loadingData && products.length === 0) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-ml-blue" size={48} />
                  <p className="text-gray-500 font-medium">Carregando seus dados...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-[#f3f4f6]">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onLogout={handleLogout} 
      />

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm">
          <h1 className="font-bold text-ml-blue">FullStock</h1>
          <button onClick={handleLogout}><LogOut size={20} className="text-red-500"/></button>
        </div>

        {notification && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className="bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
              <Bell size={16} className="text-ml-yellow" />
              {notification}
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          {currentView === ViewState.DASHBOARD && (
            <Dashboard products={products} onSync={handleSyncML} />
          )}
          {currentView === ViewState.PRODUCTS && (
            <ProductList products={products} onAddProduct={handleAddProduct} />
          )}
          {currentView === ViewState.FACTORY && (
            <FactoryControl products={products} onUpdateStock={handleUpdateFactoryStock} />
          )}
          {currentView === ViewState.BATCHES && (
            <BatchManager 
              batches={batches} 
              products={products}
              onCreateBatch={handleCreateBatch}
              onReceiveBatch={handleReceiveBatch}
            />
          )}
          {currentView === ViewState.SETTINGS && (
            <Settings settings={userSettings} onSaveSettings={handleSaveSettings} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;