import React, { useState } from 'react';
import { Batch, Product, BatchItem } from '../types';
import { Truck, CheckCircle, PackagePlus, X, Trash2, Calendar } from 'lucide-react';

interface BatchManagerProps {
  batches: Batch[];
  products: Product[];
  onCreateBatch: (items: BatchItem[], date: string) => void;
  onReceiveBatch: (batchId: string) => void;
}

const BatchManager: React.FC<BatchManagerProps> = ({ batches, products, onCreateBatch, onReceiveBatch }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Multi-item shipment state
  const [shipmentDate, setShipmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [cartItems, setCartItems] = useState<BatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add item to the "cart" (list of items to send)
  const handleAddItem = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    // Check factory stock against current cart + new quantity
    const currentInCart = cartItems.find(i => i.product_id === product.id)?.quantity || 0;
    
    if (product.stock_factory < (quantity + currentInCart)) {
      setError(`Estoque insuficiente na fábrica para ${product.title}. Disponível: ${product.stock_factory}. Já no envio: ${currentInCart}`);
      return;
    }

    setCartItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { product_id: product.id, product_title: product.title, quantity }];
    });
    
    setQuantity(1);
    setError(null);
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleSubmitShipment = () => {
    if (cartItems.length === 0) {
      setError("Adicione pelo menos um produto ao envio.");
      return;
    }
    onCreateBatch(cartItems, shipmentDate);
    setIsModalOpen(false);
    setCartItems([]);
    setError(null);
  };

  // Sort batches: Active (In Transit) first, then by date desc
  const sortedBatches = [...batches].sort((a, b) => {
    if (a.status === 'IN_TRANSIT' && b.status !== 'IN_TRANSIT') return -1;
    if (a.status !== 'IN_TRANSIT' && b.status === 'IN_TRANSIT') return 1;
    return new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Envios para o Full</h2>
          <p className="text-gray-500 text-sm">Gerencie os lotes enviados para o centro de distribuição.</p>
        </div>
        <button
          onClick={() => {
            if (products.length > 0) setSelectedProductId(products[0].id);
            setCartItems([]);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-ml-blue text-white rounded-lg hover:opacity-90 transition shadow-sm"
        >
          <PackagePlus size={18} />
          Novo Envio
        </button>
      </div>

      <div className="grid gap-4">
        {sortedBatches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Truck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum envio registrado.</p>
          </div>
        ) : (
          sortedBatches.map(batch => (
            <div key={batch.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col transition hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${batch.status === 'RECEIVED' ? 'bg-green-100 text-green-600' : 'bg-ml-yellow/20 text-yellow-700'}`}>
                    {batch.status === 'RECEIVED' ? <CheckCircle size={20} /> : <Truck size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      Envio #{batch.id.slice(-6)}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        batch.status === 'RECEIVED' 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {batch.status === 'RECEIVED' ? 'Recebido' : 'A Caminho'}
                      </span>
                    </h4>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                       <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(batch.sent_date).toLocaleDateString('pt-BR')}</span>
                       <span>•</span>
                       <span>{batch.total_quantity} itens totais</span>
                    </div>
                  </div>
                </div>

                {batch.status === 'IN_TRANSIT' && (
                  <button
                    onClick={() => onReceiveBatch(batch.id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition shadow-sm"
                  >
                    Confirmar Chegada
                  </button>
                )}
              </div>

              {/* Items List inside the Batch Card */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {batch.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm border-b last:border-0 border-gray-200 pb-2 last:pb-0">
                    <span className="text-gray-700 font-medium truncate flex-1 pr-4">{item.product_title}</span>
                    <span className="text-gray-900 font-bold whitespace-nowrap">{item.quantity} un</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Shipment Modal (Wizard Style) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 transform transition-all flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Criar Novo Envio</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {/* Date Selection */}
              <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Data de Envio</label>
                 <input 
                    type="date" 
                    value={shipmentDate}
                    onChange={(e) => setShipmentDate(e.target.value)}
                    className="w-full md:w-1/2 rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-ml-blue outline-none"
                 />
              </div>

              {/* Add Product Section */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                <h4 className="text-sm font-bold text-gray-700 mb-3">Adicionar Produtos ao Lote</h4>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Produto</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setError(null);
                      }}
                      className="w-full rounded-lg border-gray-300 border p-2.5 bg-white text-sm"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title} (Fábrica: {p.stock_factory})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qtd</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
                    />
                  </div>
                  <button 
                    onClick={handleAddItem}
                    className="bg-gray-800 text-white p-2.5 rounded-lg hover:bg-black transition flex items-center justify-center min-w-[40px]"
                  >
                    <PackagePlus size={18} />
                  </button>
                </div>
                {error && (
                  <div className="mt-3 text-xs text-red-600 font-medium">
                    {error}
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div className="mb-4">
                <h4 className="text-sm font-bold text-gray-700 mb-2">Produtos no Envio ({cartItems.length})</h4>
                {cartItems.length === 0 ? (
                  <p className="text-gray-400 text-sm italic text-center py-4 border border-dashed rounded-lg">
                    Nenhum produto adicionado ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {cartItems.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                        <span className="font-medium text-gray-800 text-sm">{item.product_title}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-ml-blue">{item.quantity} un</span>
                          <button onClick={() => handleRemoveItem(item.product_id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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
                onClick={handleSubmitShipment}
                className="flex-1 px-4 py-2 bg-ml-blue text-white rounded-lg hover:opacity-90 transition font-medium shadow-md flex justify-center items-center gap-2"
              >
                <Truck size={18} />
                Confirmar Envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchManager;