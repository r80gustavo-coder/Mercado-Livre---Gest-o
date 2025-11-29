
import { Product } from '../types';

/**
 * MERCADO LIVRE API SERVICE
 */

// Helper to get env vars safely
const getEnvVar = (key: string, fallback: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
  return fallback;
};

// LOGIC TO FORCE REAL ID:
const rawAppId = getEnvVar('NEXT_PUBLIC_ML_APP_ID', '6798471816186732');
const APP_ID = rawAppId === 'YOUR_APP_ID' ? '6798471816186732' : rawAppId;
// Client Secret is needed for Refresh Token flow (usually server-side, but used here for SPA architecture)
const CLIENT_SECRET = getEnvVar('NEXT_PUBLIC_ML_CLIENT_SECRET', '');

const ML_API_URL = 'https://api.mercadolibre.com';

// Check if the app is running with default/missing credentials
export const isMockConfiguration = () => {
  return !APP_ID || APP_ID === 'YOUR_APP_ID';
};

// 1. Authentication & Tokens
export const getAuthUrl = (origin: string) => {
  const envRedirect = getEnvVar('NEXT_PUBLIC_ML_REDIRECT_URI', '');
  const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const redirectUri = envRedirect || cleanOrigin;

  return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${redirectUri}`;
};

export const handleAuthCallback = async (code: string, userId: string) => {
    // If Client Secret is present, we exchange the code for a REAL token.
    if (CLIENT_SECRET && !isMockConfiguration()) {
         const envRedirect = getEnvVar('NEXT_PUBLIC_ML_REDIRECT_URI', '');
         const cleanOrigin = window.location.origin.replace(/\/$/, "");
         const redirectUri = envRedirect || cleanOrigin;

        try {
            console.log("Exchanging code for REAL token...");
            const response = await fetch(`${ML_API_URL}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: APP_ID,
                    client_secret: CLIENT_SECRET,
                    code: code,
                    redirect_uri: redirectUri
                })
            });

            const data = await response.json();
            if (!response.ok) {
                console.error("Token Exchange Error:", data);
                throw new Error(data.message || "Failed to exchange token");
            }
            
            return {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                user_id: data.user_id?.toString()
            };
        } catch (e) {
            console.error("Error in real token exchange:", e);
            throw e;
        }
    }

    // Fallback: Mock Tokens if secret is missing (Safety for generic users)
    console.log(`Simulating token exchange for code ${code}`);
    const mockAccessToken = `TG-${Math.random().toString(36).substring(7)}-${Date.now()}`;
    const mockRefreshToken = `TG-${Math.random().toString(36).substring(7)}`;
    const mockMlUserId = userId.substring(0, 8); 

    return {
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        user_id: mockMlUserId
    };
};

// New: Refresh Token Logic
export const refreshMLToken = async (refreshToken: string) => {
    if (isMockConfiguration() || !CLIENT_SECRET) {
        console.warn("Cannot refresh token: Missing App ID or Client Secret");
        return null;
    }

    try {
        const response = await fetch(`${ML_API_URL}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: APP_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refreshToken
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error refreshing token:", data);
            throw new Error(data.message || "Failed to refresh token");
        }

        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            user_id: data.user_id
        };

    } catch (error) {
        console.error("Refresh token exception:", error);
        return null;
    }
};

// 2. Fetch Full Stock (Real Endpoint Logic)
export const fetchFullStock = async (accessToken: string, userId: string) => {
  if (accessToken.startsWith('MOCK_') || isMockConfiguration()) {
      return [];
  }

  try {
    const searchUrl = `${ML_API_URL}/users/${userId}/items/search?logistic_type=fulfillment&access_token=${accessToken}`;
    const searchRes = await fetch(searchUrl);
    
    // Check for 401 Unauthorized
    if (searchRes.status === 401) {
        throw new Error("UNAUTHORIZED");
    }

    const searchData = await searchRes.json();
    
    if (!searchData.results || searchData.results.length === 0) return [];

    const itemIds = searchData.results;
    
    const itemsUrl = `${ML_API_URL}/items?ids=${itemIds.join(',')}&access_token=${accessToken}`;
    const itemsRes = await fetch(itemsUrl);
    
    if (itemsRes.status === 401) throw new Error("UNAUTHORIZED");

    const itemsData = await itemsRes.json();

    return itemsData.map((item: any) => ({
      ml_item_id: item.body.id,
      title: item.body.title,
      sku: item.body.seller_custom_field || item.body.id,
      stock_full: item.body.available_quantity,
      permalink: item.body.permalink,
      thumbnail: item.body.thumbnail,
    }));

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") throw error;
    console.error("Error fetching ML Stock:", error);
    return [];
  }
};

// 3. Fetch Active Items for Import
export const fetchActiveFullItems = async (accessToken: string, userId: string) => {
  if (accessToken.startsWith('MOCK_') || isMockConfiguration()) {
      return [
        {
          ml_item_id: 'MLB999888777',
          title: 'Produto Importado do ML (Simulação)',
          sku: 'MOCK-IMPORT-001',
          stock_full: 50,
          image_url: 'https://http2.mlstatic.com/D_NQ_NP_605268-MLB50837652763_072022-O.webp',
        },
        {
          ml_item_id: 'MLB111222333',
          title: 'Outro Produto Full (Simulação)',
          sku: 'MOCK-IMPORT-002',
          stock_full: 12,
          image_url: 'https://http2.mlstatic.com/D_NQ_NP_796578-MLB46575775436_072021-O.webp',
        }
      ];
  }

  try {
    const items = await fetchFullStock(accessToken, userId);
    return items.map((item: any) => ({
        ml_item_id: item.ml_item_id,
        title: item.title,
        sku: item.sku,
        stock_full: item.stock_full,
        image_url: item.thumbnail
    }));
  } catch (error) {
    throw error; // Re-throw to handle UNAUTHORIZED in caller
  }
};

// 4. Fetch Sales History (Real Endpoint Logic)
export const fetchSalesHistory = async (accessToken: string, sellerId: string) => {
  if (accessToken.startsWith('MOCK_') || isMockConfiguration()) {
      return {};
  }

  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateStr = dateFrom.toISOString();

    const url = `${ML_API_URL}/orders/search?seller=${sellerId}&order.date_created.from=${dateStr}&access_token=${accessToken}`;
    
    const res = await fetch(url);
    
    if (res.status === 401) throw new Error("UNAUTHORIZED");

    const data = await res.json();

    const salesMap: Record<string, Record<string, number>> = {}; 

    if (data.results) {
        data.results.forEach((order: any) => {
            const date = order.date_created.split('T')[0];
            order.order_items.forEach((item: any) => {
                const sku = item.item.seller_custom_field || item.item.id;
                if (!salesMap[sku]) salesMap[sku] = {};
                if (!salesMap[sku][date]) salesMap[sku][date] = 0;
                salesMap[sku][date] += item.quantity;
            });
        });
    }

    return salesMap;
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") throw error;
    console.error("Error fetching Sales:", error);
    return {};
  }
};
