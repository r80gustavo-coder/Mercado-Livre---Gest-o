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

// Updated with your Real App ID
const APP_ID = getEnvVar('NEXT_PUBLIC_ML_APP_ID', '6798471816186732');
const ML_API_URL = 'https://api.mercadolibre.com';

// Check if the app is running with default/missing credentials
export const isMockConfiguration = () => {
  return APP_ID === 'YOUR_APP_ID' || !APP_ID;
};

// 1. Authentication & Tokens
export const getAuthUrl = (origin: string) => {
  // Use the env var if explicitly set, otherwise default to current origin
  // Important: This URI must match exactly what is in the ML App settings
  const redirectUri = getEnvVar('NEXT_PUBLIC_ML_REDIRECT_URI', origin);
  return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${redirectUri}`;
};

export const handleAuthCallback = async (code: string, userId: string) => {
    // In a production backend app, we would POST to https://api.mercadolibre.com/oauth/token
    // with client_secret to get the access_token.
    
    // Since this is a client-side only demo/implementation without a secure backend to hold CLIENT_SECRET:
    // We will simulate the token exchange success and generate "dummy" tokens that effectively "Log In" the user in our database.
    // If you have a backend, replace this with a real fetch call to your server that performs the exchange.
    
    console.log(`Processing code ${code} for user ${userId}`);

    // NOTE: In a real Scenario, you would fetch real tokens here.
    // For this Vercel deployment without a backend, we mark the user as connected.
    const mockAccessToken = `TG-${Math.random().toString(36).substring(7)}-${Date.now()}`;
    const mockRefreshToken = `TG-${Math.random().toString(36).substring(7)}`;
    
    // We try to use the code to infer we are 'real', but strictly speaking we can't get the ML User ID
    // without the token exchange. We will generate a consistent ID or use the Supabase ID.
    const mockMlUserId = userId.substring(0, 8); 

    // Return the data to be saved in Supabase
    return {
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        user_id: mockMlUserId
    };
};

// 2. Fetch Full Stock (Real Endpoint Logic)
export const fetchFullStock = async (accessToken: string, userId: string) => {
  // If in mock mode, return empty array to let syncService trigger simulation
  if (accessToken.startsWith('MOCK_') || isMockConfiguration()) {
      return [];
  }

  try {
    // A. Search for items managed by Fulfillment
    // GET /users/{User_id}/items/search?logistic_type=fulfillment
    const searchUrl = `${ML_API_URL}/users/${userId}/items/search?logistic_type=fulfillment&access_token=${accessToken}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.results || searchData.results.length === 0) return [];

    const itemIds = searchData.results;
    
    // B. Get Item Details (Multiget) to find available_quantity
    // GET /items?ids=MLB123,MLB456...
    const itemsUrl = `${ML_API_URL}/items?ids=${itemIds.join(',')}&access_token=${accessToken}`;
    const itemsRes = await fetch(itemsUrl);
    const itemsData = await itemsRes.json();

    // Map response to our internal structure format
    return itemsData.map((item: any) => ({
      ml_item_id: item.body.id,
      title: item.body.title,
      sku: item.body.seller_custom_field || item.body.id, // Using seller SKU or ID
      stock_full: item.body.available_quantity,
      permalink: item.body.permalink,
      thumbnail: item.body.thumbnail,
    }));

  } catch (error) {
    console.error("Error fetching ML Stock:", error);
    return [];
  }
};

// 3. Fetch Sales History (Real Endpoint Logic)
export const fetchSalesHistory = async (accessToken: string, sellerId: string) => {
  if (accessToken.startsWith('MOCK_') || isMockConfiguration()) {
      return {};
  }

  try {
    // GET /orders/search?seller={seller_id}&order.date_created.from=2023-01-01T00:00:00.000-00:00&order.date_created.to=...
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateStr = dateFrom.toISOString();

    const url = `${ML_API_URL}/orders/search?seller=${sellerId}&order.date_created.from=${dateStr}&access_token=${accessToken}`;
    
    const res = await fetch(url);
    const data = await res.json();

    // Process orders to calculate daily sales per SKU
    const salesMap: Record<string, Record<string, number>> = {}; // SKU -> Date -> Qty

    if (data.results) {
        data.results.forEach((order: any) => {
            const date = order.date_created.split('T')[0];
            order.order_items.forEach((item: any) => {
                const sku = item.item.seller_custom_field || item.item.id; // Use SKU logic
                if (!salesMap[sku]) salesMap[sku] = {};
                if (!salesMap[sku][date]) salesMap[sku][date] = 0;
                salesMap[sku][date] += item.quantity;
            });
        });
    }

    return salesMap;
  } catch (error) {
    console.error("Error fetching Sales:", error);
    return {};
  }
};