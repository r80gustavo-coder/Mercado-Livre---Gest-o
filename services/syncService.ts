import { Product } from '../types';
import { fetchFullStock, fetchSalesHistory, fetchActiveFullItems, refreshMLToken } from './mercadolibre';
import * as db from './databaseService';

export const syncMercadoLivreData = async (
  currentProducts: Product[],
  accessToken: string | null,
  userId: string | null,
  refreshToken: string | null,
  dbUserId: string
): Promise<Product[]> => {
  
  if (!accessToken || !userId || accessToken === 'mock_token') {
    throw new Error("Conta desconectada. Vá em Configurações e conecte sua conta.");
  }

  try {
    return await executeSync(currentProducts, accessToken, userId);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" && refreshToken) {
        console.log("Token expired. Attempting refresh...");
        const newTokens = await refreshMLToken(refreshToken);
        
        if (newTokens) {
            await db.updateUserTokens(dbUserId, newTokens.user_id, newTokens.access_token, newTokens.refresh_token);
            return await executeSync(currentProducts, newTokens.access_token, newTokens.user_id);
        } else {
            // CRITICAL: Disconnect if refresh fails
            await db.disconnectMLAccount(dbUserId);
            throw new Error("Sessão expirada. Reconecte sua conta do Mercado Livre.");
        }
    }
    throw error;
  }
};

const executeSync = async (products: Product[], token: string, uid: string) => {
    const [stockData] = await Promise.all([
        fetchFullStock(token, uid),
        // fetchSalesHistory can be added here
    ]);
  
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
        if (mlItems.length === 0) return 0;

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
             } else {
                 await db.disconnectMLAccount(dbUserId);
                 throw new Error("Sessão expirada.");
             }
        }
        throw error;
    }
};