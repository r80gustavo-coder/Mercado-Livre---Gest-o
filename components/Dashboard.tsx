
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { calculateRupture, getStatusColor } from '../services/inventoryService';
import { AlertTriangle, TrendingUp, Package, Archive, RefreshCw, Wand2, Factory } from 'lucide-react';
import SalesChart from './SalesChart';
import { analyzeStockRisks } from '../services/geminiService';

interface DashboardProps {
  products: Product[];
  onSync: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ products, onSync }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Auto-sync effect: runs every 10 minutes (600000ms)
  useEffect(() => {
    const interval = setInterval(() => {
        console.log("Auto-syncing Mercado Livre data...");
        onSync();
    }, 600000); 

    return () => clearInterval(interval);
  }, [onSync]);

  const totalFull = products.reduce((acc, p) => acc + p.stock_full, 0);
  const totalFactory = products.reduce((acc, p) => acc + p.stock_factory, 0);
  const salesToday = products.reduce((acc, p) => {
    const today = new Date().toISOString().split('T')[0];
    const sale = p.sales_history.find(s => s.date === today);
    return acc + (sale ? sale.quantity : 0);
  }, 0);

  const ruptureAlerts = products.filter(p => {
    const { status } = calculateRupture(p.stock_full, p.avg_daily_sales);
    return status === 'CRITICAL';
  });

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeStockRisks(products);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
          <p className="text-gray-500">Acompanhe a saúde do seu estoque em tempo real.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleAIAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            <Wand2 size={18} />
            {isAnalyzing ? 'Analisando...' : 'IA Insights'}
          </button>
          <button 
            onClick={onSync}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={18} />
            Sincronizar ML
          </button>
        </div>
      </div>

      {aiAnalysis && (
        <div className="bg-purple-50 border border-purple-200 p-6 rounded-xl shadow-sm relative">
          <button 
            onClick={() => setAiAnalysis(null)} 
            className="absolute top-4 right-4 text-purple-400 hover:text-purple-600"
          >
            ✕
          </button>
          <h3 className="text-purple-900 font-bold mb-2 flex items-center gap-2">
            <Wand2 size={20} /> Análise Inteligente de Estoque
          </h3>
          <div className="prose prose-sm text-purple-900 whitespace-pre-line">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Estoque no Full</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalFull}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Package size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Estoque Fábrica</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalFactory}</h3>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Factory size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Vendas Hoje</p>
              <h3 className="text-2xl font-bold text-gray-900">{salesToday}</h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Rupturas Próximas</p>
              <h3 className={`text-2xl font-bold ${ruptureAlerts.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {ruptureAlerts.length}
              </h3>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Vendas - Últimos 30 Dias</h3>
          <SalesChart products={products} />
        </div>

        {/* Alerts List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Alertas de Ruptura</h3>
          <div className="space-y-3">
            {ruptureAlerts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nenhum alerta crítico.</p>
            ) : (
              ruptureAlerts.map(product => {
                const prediction = calculateRupture(product.stock_full, product.avg_daily_sales);
                return (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-bold text-gray-900 truncate">{product.sku}</p>
                      <p className="text-xs text-red-700">Acaba em {prediction.daysLeft} dias</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold bg-white px-2 py-1 rounded text-red-600 border border-red-200">
                        {product.stock_full} un
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
