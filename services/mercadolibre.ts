const ML_API_URL = 'https://api.mercadolibre.com';
const AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';

// Helper to check if we have a real App ID configured
export const getAppId = () => {
  // 1. Tenta pegar do import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.NEXT_PUBLIC_ML_APP_ID) {
    // @ts-ignore
    const envId = import.meta.env.NEXT_PUBLIC_ML_APP_ID;
    if (envId && envId !== 'YOUR_APP_ID') return envId;
  }
  // 2. Tenta pegar do process.env (Polyfill)
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_ML_APP_ID) {
    const envId = process.env.NEXT_PUBLIC_ML_APP_ID;
    if (envId && envId !== 'YOUR_APP_ID') return envId;
  }
  return null;
};

export const getClientSecret = () => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.NEXT_PUBLIC_ML_CLIENT_SECRET) {
    // @ts-ignore
    return import.meta.env.NEXT_PUBLIC_ML_CLIENT_SECRET;
  }
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_ML_CLIENT_SECRET) {
    return process.env.NEXT_PUBLIC_ML_CLIENT_SECRET;
  }
  return null;
};

export const isMockConfiguration = () => {
  return !getAppId();
};

// --- PKCE HELPERS ---

// Generate a random string for code_verifier
const generateCodeVerifier = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
};

// Hash the verifier to create code_challenge (SHA-256)
const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  
  // Convert buffer to base64url
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const getAuthUrl = async (origin: string) => {
  const appId = getAppId();
  // Ensure no trailing slash
  const redirectUri = origin.replace(/\/$/, ""); 
  
  if (!appId) {
    throw new Error("App ID não configurado.");
  }

  // 1. Generate PKCE Verifier
  const codeVerifier = generateCodeVerifier();
  // 2. Save it to verify later
  localStorage.setItem('ml_code_verifier', codeVerifier);
  // 3. Generate Challenge
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return `${AUTH_URL}?response_type=code&client_id=${appId}&redirect_uri=${redirectUri}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
};

// --- AUTH HANDLER ---

export const handleAuthCallback = async (code: string, userId: string) => {
  const appId = getAppId();
  const clientSecret = getClientSecret();
  const redirectUri = window.location.origin.replace(/\/$/, "");
  
  // Retrieve PKCE verifier
  const codeVerifier = localStorage.getItem('ml_code_verifier');

  // MOCK MODE (Fallback if no App ID)
  if (!appId) {
    console.warn("Using MOCK Auth because App ID is missing.");
    return {
      access_token: `mock_access_${Date.now()}`,
      refresh_token: `mock_refresh_${Date.now()}`,
      user_id: '123456789',
      expires_in: 21600,
    };
  }

  if (!clientSecret) {
      throw new Error("Client Secret não configurado no Vercel (NEXT_PUBLIC_ML_CLIENT_SECRET).");
  }

  if (!codeVerifier) {
      throw new Error("PKCE Verifier not found. Please try connecting again.");
  }

  // REAL OAUTH EXCHANGE
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', appId);
    params.append('client_secret', clientSecret);
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', codeVerifier); // Send verifier to prove identity

    const response = await fetch(`${ML_API_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: params
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("ML Auth Error:", data);
        // Map common errors to friendly messages
        if (data.error === 'invalid_grant') throw new Error("Código de autorização inválido ou expirado. Tente novamente.");
        if (data.error === 'invalid_client') throw new Error("Credenciais do App inválidas (Client Secret incorreto).");
        if (data.error === 'redirect_uri_mismatch') throw new Error(`URL de redirecionamento incorreta. Cadastre exatamente: ${redirectUri}`);
        
        throw new Error(data.message || data.error || "Erro ao trocar token.");
    }

    // Clean up
    localStorage.removeItem('ml_code_verifier');

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_id: data.user_id.toString(),
        expires_in: data.expires_in
    };

  } catch (error: any) {
      console.error("Token Exchange Failed:", error);
      throw error;
  }
};

export const refreshMLToken = async (refreshToken: string) => {
    const appId = getAppId();
    const clientSecret = getClientSecret();

    if (!appId || !clientSecret) return null;

    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', appId);
        params.append('client_secret', clientSecret);
        params.append('refresh_token', refreshToken);

        const response = await fetch(`${ML_API_URL}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params
        });

        const data = await response.json();
        if (!response.ok) return null;

        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            user_id: data.user_id.toString()
        };
    } catch (e) {
        console.error("Error refreshing token:", e);
        return null;
    }
};

// --- DATA FETCHING ---

export const fetchFullStock = async (accessToken: string, userId: string) => {
  try {
    // 1. Search for Fulfillment items
    const searchUrl = `${ML_API_URL}/users/${userId}/items/search?logistic_type=fulfillment&access_token=${accessToken}`;
    const searchRes = await fetch(searchUrl);
    
    if (searchRes.status === 401) throw new Error("UNAUTHORIZED");
    
    const searchData = await searchRes.json();
    
    if (!searchData.results || searchData.results.length === 0) return [];

    const itemIds = searchData.results;
    
    // 2. Get Item Details (Chunked if necessary, simplified here)
    // ML allows multiget up to 20 items usually, assume small inventory or need chunking logic for prod
    // For this demo we take first 50
    const idsToFetch = itemIds.slice(0, 50).join(',');
    const itemsUrl = `${ML_API_URL}/items?ids=${idsToFetch}&access_token=${accessToken}`;
    const itemsRes = await fetch(itemsUrl);
    
    if (itemsRes.status === 401) throw new Error("UNAUTHORIZED");

    const itemsData = await itemsRes.json();

    return itemsData.map((item: any) => ({
      ml_item_id: item.body.id,
      title: item.body.title,
      sku: item.body.seller_custom_field || item.body.id, // Fallback to ID if no SKU
      stock_full: item.body.available_quantity,
      permalink: item.body.permalink,
      thumbnail: item.body.thumbnail,
    }));

  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') throw error;
    console.error("Error fetching ML Stock:", error);
    return [];
  }
};

export const fetchActiveFullItems = async (accessToken: string, userId: string) => {
   try {
    const searchUrl = `${ML_API_URL}/users/${userId}/items/search?status=active&limit=100&access_token=${accessToken}`;
    const searchRes = await fetch(searchUrl);
    
    if (searchRes.status === 401) throw new Error("UNAUTHORIZED");

    const searchData = await searchRes.json();
    if (!searchData.results || searchData.results.length === 0) return [];

    const itemIds = searchData.results.slice(0, 50).join(','); // Limit 50 for multiget
    const itemsUrl = `${ML_API_URL}/items?ids=${itemIds}&access_token=${accessToken}`;
    
    const itemsRes = await fetch(itemsUrl);
    if (itemsRes.status === 401) throw new Error("UNAUTHORIZED");
    
    const itemsData = await itemsRes.json();
    
    return itemsData.map((i: any) => {
        // Detect if item is fulfillment
        const isFull = i.body.shipping?.logistic_type === 'fulfillment';
        return {
            ml_item_id: i.body.id,
            title: i.body.title,
            sku: i.body.seller_custom_field || i.body.id,
            image_url: i.body.thumbnail,
            stock_full: isFull ? i.body.available_quantity : 0 // Only use stock if already in full
        };
    });

   } catch (error: any) {
       if (error.message === 'UNAUTHORIZED') throw error;
       console.error("Error fetching active items:", error);
       return [];
   }
};

export const fetchSalesHistory = async (accessToken: string, sellerId: string) => {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateStr = dateFrom.toISOString();

    const url = `${ML_API_URL}/orders/search?seller=${sellerId}&order.date_created.from=${dateStr}&access_token=${accessToken}`;
    const res = await fetch(url);
    
    if (res.status === 401) throw new Error("UNAUTHORIZED");

    const data = await res.json();
    return data; // Process in Sync Service
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') throw error;
    console.error("Error fetching Sales:", error);
    return {};
  }
};