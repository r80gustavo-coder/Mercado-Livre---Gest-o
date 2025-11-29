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

// Configurações
const rawAppId = getEnvVar('NEXT_PUBLIC_ML_APP_ID', '');
// Se o usuário não configurou nada ou deixou o padrão, assumimos string vazia para forçar erro de config ou modo mock manual
const APP_ID = rawAppId === 'YOUR_APP_ID' ? '' : rawAppId;
const CLIENT_SECRET = getEnvVar('NEXT_PUBLIC_ML_CLIENT_SECRET', '');
const ML_API_URL = 'https://api.mercadolibre.com';

// Check if the app is running with default/missing credentials
export const isMockConfiguration = () => {
  return !APP_ID;
};

// --- PKCE HELPERS ---

function generateRandomString(length: number) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

async function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return hash;
}

function base64UrlEncode(a: ArrayBuffer) {
  let str = "";
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// 1. Authentication & Tokens

export const getAuthUrl = async (origin: string) => {
  const envRedirect = getEnvVar('NEXT_PUBLIC_ML_REDIRECT_URI', '');
  const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const redirectUri = envRedirect || cleanOrigin;

  // Gerar PKCE Verifier e Challenge
  const codeVerifier = generateRandomString(128);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hashed);

  // Salvar o verifier para usar no callback
  localStorage.setItem('ml_code_verifier', codeVerifier);

  return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${redirectUri}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
};

export const handleAuthCallback = async (code: string, userId: string) => {
    const envRedirect = getEnvVar('NEXT_PUBLIC_ML_REDIRECT_URI', '');
    const cleanOrigin = window.location.origin.replace(/\/$/, "");
    const redirectUri = envRedirect || cleanOrigin;

    // Recuperar o Code Verifier salvo antes do redirect
    const codeVerifier = localStorage.getItem('ml_code_verifier');

    // Se Client Secret ou Verifier estiverem faltando, não conseguimos trocar o token
    if (!CLIENT_SECRET || !codeVerifier) {
         if (!CLIENT_SECRET) throw new Error("Client Secret não configurado no Vercel.");
         if (!codeVerifier) throw new Error("Erro de segurança PKCE: Verifier não encontrado. Tente novamente.");
    }

    try {
        console.log("Exchanging code for REAL token...");
        
        // Limpar o storage
        localStorage.removeItem('ml_code_verifier');

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
                redirect_uri: redirectUri,
                code_verifier: codeVerifier // PKCE OBRIGATÓRIO
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Token Exchange Error:", data);
            
            let errorMessage = "Falha na conexão com o Mercado Livre.";
            
            if (data.error === 'invalid_grant') {
                errorMessage = "O código expirou. Tente conectar novamente.";
            } else if (data.error === 'invalid_client') {
                errorMessage = "Erro de configuração: Client Secret ou App ID inválidos.";
            } else if (data.message) {
                errorMessage = `Erro do ML: ${data.message}`;
            }

            throw new Error(errorMessage);
        }
        
        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            user_id: data.user_id?.toString()
        };
    } catch (e: any) {
        console.error("Error in real token exchange:", e);
        throw e;
    }
};

export const refreshMLToken = async (refreshToken: string) => {
    if (!APP_ID || !CLIENT_SECRET) {
        console.warn("Cannot refresh token: Missing Credentials");
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
            return null; // Retorna null para disparar a desconexão no syncService
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

// 2. Fetch Full Stock
export const fetchFullStock = async (accessToken: string, userId: string) => {
  if (!accessToken || accessToken === 'mock_token') return [];

  try {
    const searchUrl = `${ML_API_URL}/users/${userId}/items/search?logistic_type=fulfillment&access_token=${accessToken}`;
    const searchRes = await fetch(searchUrl);
    
    if (searchRes.status === 401) {
        throw new Error("UNAUTHORIZED");
    }

    const searchData = await searchRes.json();
    
    if (!searchData.results || searchData.results.length === 0) return [];

    const itemIds = searchData.results;
    
    // ML limitation: Items API allows up to 20 IDs per request usually, but let's try all or paginate in future
    // For now taking first 50 just to be safe or join all
    const itemsUrl = `${ML_API_URL}/items?ids=${itemIds.slice(0,20).join(',')}&attributes=id,title,available_quantity,thumbnail,permalink,seller_custom_field&access_token=${accessToken}`;
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
  if (!accessToken || accessToken === 'mock_token') {
      throw new Error("Token inválido para importação.");
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
    throw error;
  }
};

// 4. Fetch Sales History
export const fetchSalesHistory = async (accessToken: string, sellerId: string) => {
  if (!accessToken || accessToken === 'mock_token') return {};

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