
import React, { useState } from 'react';
import { Product } from '../types';
import { calculateRupture, getStatusColor } from '../services/inventoryService';
import { Plus, X, Image as ImageIcon, DownloadCloud } from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onAddProduct?: (product: Omit<Product, 'id' | 'sales_history' | 'avg_daily_sales' | 'stock_full' | 'stock_scheduled'>) => void;
  onImportML?: () => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onAddProduct, onImportML }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cost, setCost] = useState('');
  const [stockFactory, setStockFactory] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddProduct) {
      onAddProduct({
        title,
        sku,
        image_url: imageUrl || 'https://via.placeholder.com/100',
        cost_per_unit: Number(cost),
        stock_factory: Number(stockFactory)
      });
      setIsModalOpen(false);
      // Reset form
      setTitle('');
      setSku('');
      setImageUrl('');
      setCost('');
      setStockFactory('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Produtos</h2>
        <div className="flex gap-2">
            {onImportML && (
                <button
                    onClick={onImportML}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm"
                >
                    <DownloadCloud size={18} /> Importar do ML
                </button>
            )}
            {onAddProduct && (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-ml-blue text-white rounded-lg hover:opacity-90 transition shadow-sm"
            >
                <Plus size={18} /> Novo Produto
            </button>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Produto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Fábrica</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center bg-yellow-50 text-yellow-800">Programado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Full</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Vendas/Dia</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Previsão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const rupture = calculateRupture(product.stock_full, product.avg_daily_sales);
                const statusColor = getStatusColor(rupture.status);

                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={product.image_url} alt={product.title} className="w-10 h-10 rounded-md object-cover bg-gray-200" />
                        <div>
                          <p className="font-medium text-gray-900">{product.title}</p>
                          <p className="text-xs text-gray-500">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                        {product.stock_factory}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center bg-yellow-50/50">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${product.stock_scheduled > 0 ? 'bg-yellow-100 text-yellow-700' : 'text-gray-300'}`}>
                        {product.stock_scheduled}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                        {product.stock_full}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {product.avg_daily_sales.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex flex-col items-center px-3 py-1 rounded-lg border ${statusColor}`}>
                        <span className="font-bold text-sm">{rupture.daysLeft} dias</span>
                        <span className="text-[10px] uppercase tracking-wide opacity-80">
                          {rupture.status === 'HEALTHY' ? 'Seguro' : rupture.status === 'WARNING' ? 'Atenção' : 'Crítico'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Cadastrar Novo Produto</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título do Anúncio</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none"
                    placeholder="Ex: Mouse Gamer RGB..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none"
                    placeholder="MOUSE-001"
                  />
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Fábrica (Inicial)</label>
                   <input
                    type="number"
                    min="0"
                    required
                    value={stockFactory}
                    onChange={(e) => setStockFactory(e.target.value)}
                    className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none"
                  />
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Custo Unitário (R$)</label>
                   <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL da Imagem</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none"
                      placeholder="https://..."
                    />
                    <div className="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                      {imageUrl ? (
                        <img src={imageUrl} alt="preview" className="w-full h-full object-cover rounded-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <ImageIcon size={20} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-ml-blue text-white rounded-lg hover:opacity-90 transition font-medium shadow-md flex justify-center items-center gap-2"
                  >
                    <Plus size={18} />
                    Salvar Produto
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
