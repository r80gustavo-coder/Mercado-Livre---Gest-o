
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import FactoryControl from './components/FactoryControl';
import BatchManager from './components/BatchManager';
import Settings from './components/Settings';
import Login from './components/Login';
import { Product, Batch, ViewState, BatchItem, UserSettings, BatchStatus } from './types';
import { syncMercadoLivreData } from './services/syncService';
import { LogOut, Bell, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import * as db from './services/databaseService';

const App: React.FC = () => {
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
  useEffect(() => {
    if (session?.user) {
      loadUserData();
    }
  }, [session]);

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
      showNotify("Erro ao carregar dados do servidor");
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
  };

  const handleSyncML = async () => {
    showNotify('Iniciando sincronização com Mercado Livre...');
    
    // In production, this token comes from DB (encrypted)
    const accessToken = userSettings.is_connected_ml ? 'mock_token' : null; 
    const userId = userSettings.ml_user_id;

    if (!userId) {
        showNotify("Erro: ID do usuário ML não encontrado.");
        return;
    }

    try {
      // 1. Fetch ML data
      const updatedProducts = await syncMercadoLivreData(products, accessToken, userId);
      
      // 2. Update DB for each changed product
      // Optimization: In real app, do bulk upsert
      for (const p of updatedProducts) {
         await db.updateProductStock(p.id, { 
             stock_full: p.stock_full 
             // Note: Sales history update would go here
         });
      }

      // 3. Reload state
      await loadUserData();
      
      showNotify('Sincronização com Mercado Livre concluída!');
    } catch (e) {
      console.error(e);
      showNotify('Erro ao sincronizar.');
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

  // Create a new product
  const handleAddProduct = async (newProductData: Omit<Product, 'id' | 'sales_history' | 'avg_daily_sales' | 'stock_full' | 'stock_scheduled'>) => {
    if (!session?.user?.id) return;
    
    try {
        const newDbProduct = await db.createProduct(session.user.id, newProductData);
        // Optimistic update or reload
        await loadUserData();
        showNotify('Produto cadastrado com sucesso!');
    } catch (error) {
        console.error(error);
        showNotify('Erro ao criar produto.');
    }
  };

  // Create Shipment
  const handleCreateBatch = async (items: BatchItem[], date: string) => {
    if (!session?.user?.id) return;

    // 1. Validate Stock locally first
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      if (!product || product.stock_factory < item.quantity) {
        showNotify(`Erro: Estoque insuficiente para ${item.product_title}`);
        return;
      }
    }

    try {
        // 2. Create Batch in DB
        const totalQty = items.reduce((acc, item) => acc + item.quantity, 0);
        const newBatchData: Partial<Batch> = {
            total_quantity: totalQty,
            status: 'IN_TRANSIT',
            sent_date: date,
            items: items
        };
        await db.createBatch(session.user.id, newBatchData);

        // 3. Update Product Stocks (Factory -> Scheduled)
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
        // 1. Update Batch Status
        await db.updateBatchStatus(batchId, 'RECEIVED', new Date().toISOString());

        // 2. Move Scheduled -> Full
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
        // Optimistic update
        setProducts(prev => prev.map(p => 
            p.id === productId ? { ...p, stock_factory: newStock } : p
        ));
        showNotify('Estoque de fábrica atualizado.');
    } catch (error) {
        showNotify('Erro ao atualizar estoque.');
    }
  };

  // View Logic
  if (!session) {
    return <Login onLogin={() => {}} />; // The useEffect will handle session change
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
