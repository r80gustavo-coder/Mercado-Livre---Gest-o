
import { Product } from '../types';

/**
 * MERCADO LIVRE API SERVICE
 * In a real Next.js app, these functions should primarily run on the SERVER side 
 * (Server Actions or API Routes) to protect your CLIENT_SECRET and avoid CORS.
 */

const ML_API_URL = 'https://api.mercadolibre.com';
const APP_ID = process.env.NEXT_PUBLIC_ML_APP_ID || 'YOUR_APP_ID';
const REDIRECT_URI = process.env.NEXT_PUBLIC_ML_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

// 1. Authentication & Tokens
export const getAuthUrl = () => {
  return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}`;
};

// 2. Fetch Full Stock (Real Endpoint Logic)
export const fetchFullStock = async (accessToken: string, userId: string) => {
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
    // Note: In production, batch this in groups of 20
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
    // Return mock data for the demo environment if API fails
    return [];
  }
};

// 3. Fetch Sales History (Real Endpoint Logic)
export const fetchSalesHistory = async (accessToken: string, sellerId: string) => {
  try {
    // GET /orders/search?seller={seller_id}&order.date_created.from=2023-01-01T00:00:00.000-00:00&order.date_created.to=...
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateStr = dateFrom.toISOString();

    const url = `${ML_API_URL}/orders/search?seller=${sellerId}&order.date_created.from=${dateStr}&access_token=${accessToken}`;
    
    const res = await fetch(url);
    const data = await res.json();

    // Process orders to calculate daily sales per SKU
    // This logic would be complex in real life (handling variations, multiple items per order)
    // Here is a simplified version:
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
