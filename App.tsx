import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import FactoryControl from './components/FactoryControl';
import BatchManager from './components/BatchManager';
import Settings from './components/Settings';
import Login from './components/Login';
import AuthCallback from './components/AuthCallback';
import { Product, Batch, ViewState, BatchItem, UserSettings } from './types';
import { syncMercadoLivreData, importProductsFromML } from './services/syncService';
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
          <p className="text-blue-400">NEXT_PUBLIC_ML_APP_ID<span className="text-white">=(Opcional) ID do App ML</span></p>
          <p className="text-blue-400">NEXT_PUBLIC_ML_CLIENT_SECRET<span className="text-white">=(Obrigatório para login real)</span></p>
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('code') || params.get('error')) {
      setCurrentView(ViewState.CALLBACK);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Data Fetching
  const loadUserData = useCallback(async () => {
    if (!session?.user?.id) return;
    
    if (products.length === 0) setLoadingData(true);

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
      showNotify("Erro ao carregar dados.");
    } finally {
      setLoadingData(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user && currentView !== ViewState.CALLBACK) {
      loadUserData();
    }
  }, [session, currentView, loadUserData]);

  // 3. Realtime Subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    let debounceTimer: any;
    const refreshData = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log("Realtime update detected.");
            loadUserData();
        }, 1500); // 1.5s debounce
    };

    const productSub = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .subscribe();

    const batchSub = supabase
      .channel('public:batches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches', filter: `user_id=eq.${session.user.id}` }, refreshData)
      .subscribe();

    return () => {
      supabase.removeChannel(productSub);
      supabase.removeChannel(batchSub);
    };
  }, [session?.user?.id, loadUserData]);

  // Actions
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentView(ViewState.LOGIN);
    setProducts([]);
    setBatches([]);
    setUserSettings({ is_connected_ml: false, alert_threshold_days: 5 });
  };

  const handleSyncML = async () => {
    showNotify('Sincronizando Mercado Livre...');
    
    // Refresh user settings to ensure we have latest token
    const currentSettings = await db.getUserSettings(session?.user?.id);
    
    const accessToken = currentSettings.is_connected_ml ? (currentSettings.ml_access_token || 'mock_token') : null; 
    const refreshToken = currentSettings.ml_refresh_token || null;
    const userId = currentSettings.ml_user_id;

    if (!userId && currentSettings.is_connected_ml) {
        showNotify("Erro: ID de usuário ML não encontrado.");
        return;
    }

    try {
      const updatedProducts = await syncMercadoLivreData(
          products, 
          accessToken, 
          userId || null, 
          refreshToken, 
          session?.user?.id
      );
      
      // Update DB
      await Promise.all(updatedProducts.map(p => 
         db.updateProductStock(p.id, { stock_full: p.stock_full })
      ));

      showNotify('Sincronização concluída!');
    } catch (e: any) {
      console.error(e);
      showNotify(e.message || 'Erro ao sincronizar.');
      // Reload in case token state changed
      await loadUserData(); 
    }
  };
  
  const handleImportML = async () => {
      showNotify('Buscando produtos...');
      const currentSettings = await db.getUserSettings(session?.user?.id);
      
      try {
          const count = await importProductsFromML(
              products, 
              currentSettings.ml_access_token || null, 
              currentSettings.ml_user_id || null, 
              session?.user?.id,
              currentSettings.ml_refresh_token || null
          );
          if (count > 0) showNotify(`${count} produtos importados!`);
          else showNotify('Nenhum produto novo.');
      } catch (e: any) {
          showNotify(e.message || 'Erro ao importar.');
      }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    if (!session?.user?.id) return;
    try {
        await db.updateUserSettings(session.user.id, newSettings);
        setUserSettings(newSettings);
        showNotify('Configurações salvas.');
    } catch (error) {
        showNotify('Erro ao salvar.');
    }
  };

  const handleAddProduct = async (newProductData: Omit<Product, 'id' | 'sales_history' | 'avg_daily_sales' | 'stock_full' | 'stock_scheduled'>) => {
    if (!session?.user?.id) return;
    try {
        await db.createProduct(session.user.id, newProductData);
        showNotify('Produto cadastrado!');
    } catch (error) {
        showNotify('Erro ao criar produto.');
    }
  };

  const handleCreateBatch = async (items: BatchItem[], date: string) => {
    if (!session?.user?.id) return;
    try {
        const totalQty = items.reduce((acc, item) => acc + item.quantity, 0);
        const newBatchData: Partial<Batch> = {
            total_quantity: totalQty,
            status: 'IN_TRANSIT',
            sent_date: date,
            items: items
        };
        await db.createBatch(session.user.id, newBatchData);

        // Update local stock
        for (const item of items) {
            const product = products.find(p => p.id === item.product_id);
            if (product) {
                await db.updateProductStock(product.id, {
                    stock_factory: product.stock_factory - item.quantity,
                    stock_scheduled: product.stock_scheduled + item.quantity
                });
            }
        }
        showNotify('Envio criado!');
        setCurrentView(ViewState.BATCHES);
    } catch (error) {
        showNotify('Erro ao criar envio.');
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
        showNotify(`Lote recebido!`);
    } catch (error) {
        showNotify('Erro ao receber lote.');
    }
  };

  const handleUpdateFactoryStock = async (productId: string, newStock: number) => {
    try {
        await db.updateProductStock(productId, { stock_factory: newStock });
        showNotify('Estoque atualizado.');
    } catch (error) {
        showNotify('Erro ao atualizar.');
    }
  };

  if (!session && currentView !== ViewState.CALLBACK) {
    return <Login onLogin={() => {}} />; 
  }

  if (currentView === ViewState.CALLBACK) {
      return (
        <AuthCallback 
          onSuccess={() => {
            window.history.replaceState({}, document.title, window.location.pathname);
            setCurrentView(ViewState.SETTINGS);
            loadUserData();
          }} 
          onBack={() => {
             window.history.replaceState({}, document.title, window.location.pathname);
             setCurrentView(ViewState.SETTINGS);
          }}
        />
      );
  }

  if (loadingData && products.length === 0) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-ml-blue" size={48} />
                  <p className="text-gray-500 font-medium">Carregando dados...</p>
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
            <ProductList products={products} onAddProduct={handleAddProduct} onImportML={handleImportML} />
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