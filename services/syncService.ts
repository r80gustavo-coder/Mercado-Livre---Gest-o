
import { Product } from '../types';
import { fetchFullStock, fetchSalesHistory, fetchActiveFullItems, refreshMLToken } from './mercadolibre';
import * as db from './databaseService';

/**
 * SYNC SERVICE
 * Orchestrates the data flow: ML API -> Application State -> Database
 */

export const syncMercadoLivreData = async (
  currentProducts: Product[],
  accessToken: string | null,
  userId: string | null,
  refreshToken: string | null, // Added Refresh Token
  dbUserId: string // Added DB User ID for saving tokens
): Promise<Product[]> => {
  
  // 1. Validation
  if (!accessToken || !userId) {
    console.warn("Cannot sync: Missing ML credentials");
    return simulateSync(currentProducts);
  }

  try {
    // 2. Try Fetch Real Data
    return await executeSync(currentProducts, accessToken, userId);

  } catch (error: any) {
    // 3. Handle Token Expiration
    if (error.message === "UNAUTHORIZED" && refreshToken) {
        console.log("Token expired. Attempting refresh...");
        
        const newTokens = await refreshMLToken(refreshToken);
        
        if (newTokens) {
            console.log("Token refreshed successfully. Saving to DB...");
            await db.updateUserTokens(dbUserId, newTokens.user_id, newTokens.access_token, newTokens.refresh_token);
            
            console.log("Retrying sync with new token...");
            return await executeSync(currentProducts, newTokens.access_token, newTokens.user_id);
        } else {
            console.error("Failed to refresh token.");
            throw new Error("Sessão expirada. Reconecte sua conta do Mercado Livre.");
        }
    }
    
    // Propagate other errors
    throw error;
  }
};

// Helper to execute the fetch logic
const executeSync = async (products: Product[], token: string, uid: string) => {
    const [stockData, salesData] = await Promise.all([
        fetchFullStock(token, uid),
        fetchSalesHistory(token, uid)
    ]);
  
    // Merge logic
    return products.map(product => {
      let mlItem = null;
      if (product.ml_item_id) {
          mlItem = stockData.find((i: any) => i.ml_item_id === product.ml_item_id);
      } else {
          mlItem = stockData.find((i: any) => i.sku === product.sku);
      }
      return {
        ...product,
        stock_full: mlItem ? mlItem.stock_full : product.stock_full,
      };
    });
};

// New function to import products not yet in the system
export const importProductsFromML = async (
    currentProducts: Product[], 
    accessToken: string | null, 
    mlUserId: string | null,
    dbUserId: string,
    refreshToken: string | null
) => {
    if (!accessToken || !mlUserId) {
        throw new Error("Conecte ao Mercado Livre primeiro.");
    }

    const executeImport = async (token: string) => {
        const mlItems = await fetchActiveFullItems(token, mlUserId);
        const newItems = mlItems.filter((item: any) => {
            const exists = currentProducts.some(p => 
                p.sku === item.sku || p.ml_item_id === item.ml_item_id
            );
            return !exists;
        });

        if (newItems.length === 0) return 0;

        const productsToCreate = newItems.map((item: any) => ({
            title: item.title,
            sku: item.sku,
            image_url: item.image_url,
            stock_full: item.stock_full,
            stock_factory: 0,
            cost_per_unit: 0,
            ml_item_id: item.ml_item_id
        }));

        await db.bulkCreateProducts(dbUserId, productsToCreate);
        return newItems.length;
    };

    try {
        return await executeImport(accessToken);
    } catch (error: any) {
        if (error.message === "UNAUTHORIZED" && refreshToken) {
             const newTokens = await refreshMLToken(refreshToken);
             if (newTokens) {
                 await db.updateUserTokens(dbUserId, newTokens.user_id, newTokens.access_token, newTokens.refresh_token);
                 return await executeImport(newTokens.access_token);
             }
        }
        throw error;
    }
};

const simulateSync = (products: Product[]): Product[] => {
  return products.map(p => {
    const salesChange = Math.random() > 0.6 ? Math.floor(Math.random() * 4) : 0;
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
