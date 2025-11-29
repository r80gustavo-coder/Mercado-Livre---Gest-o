
import { Product } from '../types';
import { fetchFullStock, fetchSalesHistory } from './mercadolibre';

/**
 * SYNC SERVICE
 * Orchestrates the data flow: ML API -> Application State -> Database
 */

export const syncMercadoLivreData = async (
  currentProducts: Product[],
  accessToken: string | null,
  userId: string | null
): Promise<Product[]> => {
  
  // 1. Validation
  if (!accessToken || !userId) {
    console.warn("Cannot sync: Missing ML credentials");
    // In a real app, this would throw error or return current state
    return simulateSync(currentProducts);
  }

  // 2. Fetch Real Data (Parallel execution)
  const [stockData, salesData] = await Promise.all([
    fetchFullStock(accessToken, userId),
    fetchSalesHistory(accessToken, userId)
  ]);

  // 3. Merge with Local Products
  // We match products by SKU or ML Item ID
  const updatedProducts = currentProducts.map(product => {
    let mlItem = null;
    
    // Try to find match in fetched stock data
    if (product.ml_item_id) {
        mlItem = stockData.find((i: any) => i.ml_item_id === product.ml_item_id);
    } else {
        mlItem = stockData.find((i: any) => i.sku === product.sku);
    }

    // Calculate new Sales History if we have data
    let newSalesHistory = product.sales_history;
    let newAvg = product.avg_daily_sales;

    // (Simplified sales merge logic here would go here in real app)
    
    return {
      ...product,
      stock_full: mlItem ? mlItem.stock_full : product.stock_full, // Update stock from Full
      // ml_item_id: mlItem ? mlItem.ml_item_id : product.ml_item_id, // Link ID if found
    };
  });

  return updatedProducts;
};

// Fallback simulator for this demo environment since we don't have a real valid Access Token
const simulateSync = (products: Product[]): Product[] => {
  return products.map(p => {
    const salesChange = Math.random() > 0.6 ? Math.floor(Math.random() * 4) : 0;
    
    // Shift sales history
    const newHistory = [...p.sales_history.slice(1)];
    newHistory.push({
        date: new Date().toISOString().split('T')[0],
        quantity: salesChange
    });

    const newStockFull = Math.max(0, p.stock_full - salesChange);

    return {
      ...p,
      stock_full: newStockFull,
      sales_history: newHistory,
      avg_daily_sales: newHistory.reduce((acc, curr) => acc + curr.quantity, 0) / 30
    };
  });
};
