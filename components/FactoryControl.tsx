
import React, { useState } from 'react';
import { Product } from '../types';
import { Factory, Plus, Save } from 'lucide-react';

interface FactoryControlProps {
  products: Product[];
  onUpdateStock: (productId: string, newStock: number) => void;
}

const FactoryControl: React.FC<FactoryControlProps> = ({ products, onUpdateStock }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [productionAmount, setProductionAmount] = useState<Record<string, number>>({});

  const handleProductionChange = (id: string, value: number) => {
    setProductionAmount(prev => ({ ...prev, [id]: value }));
  };

  const commitProduction = (product: Product) => {
    const amount = productionAmount[product.id] || 0;
    if (amount <= 0) return;
    
    onUpdateStock(product.id, product.stock_factory + amount);
    setProductionAmount(prev => ({ ...prev, [product.id]: 0 }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Controle de Fábrica</h2>
          <p className="text-gray-500 text-sm">Gerencie o estoque físico e registre novas produções.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Produto / SKU</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Estoque Atual</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Registrar Produção</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                         <Factory size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.title}</p>
                        <p className="text-xs text-gray-500 font-mono">{product.sku}</p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full font-bold">
                      {product.stock_factory} un
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <div className="relative flex-1">
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0"
                          value={productionAmount[product.id] || ''}
                          onChange={(e) => handleProductionChange(product.id, parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none text-sm"
                        />
                        <div className="absolute right-3 top-2 text-xs text-gray-400 font-medium">+ PROD</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => commitProduction(product)}
                      disabled={!productionAmount[product.id] || productionAmount[product.id] <= 0}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save size={16} />
                      Salvar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FactoryControl;
