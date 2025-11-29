import { supabase } from '../lib/supabaseClient';
import { Product, Batch, UserSettings } from '../types';

// --- PRODUCTS ---

export const getProducts = async (userId: string): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      sales_daily (
        date,
        quantity_sold
      )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    user_id: item.user_id,
    sku: item.sku,
    title: item.title,
    image_url: item.image_url || 'https://via.placeholder.com/100',
    cost_per_unit: item.cost_per_unit,
    stock_factory: item.stock_factory || 0,
    stock_scheduled: item.stock_scheduled || 0,
    stock_full: item.stock_full || 0,
    ml_item_id: item.full_listing_id,
    avg_daily_sales: calculateAvgSales(item.sales_daily || []),
    sales_history: (item.sales_daily || []).map((s: any) => ({
      date: s.date,
      quantity: s.quantity_sold
    }))
  }));
};

export const createProduct = async (userId: string, product: Partial<Product>) => {
  const { data, error } = await supabase
    .from('products')
    .insert([{
      user_id: userId,
      title: product.title,
      sku: product.sku,
      cost_per_unit: product.cost_per_unit,
      stock_factory: product.stock_factory,
      image_url: product.image_url
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProductStock = async (productId: string, updates: Partial<Product>) => {
  const dbUpdates: any = {};
  if (updates.stock_factory !== undefined) dbUpdates.stock_factory = updates.stock_factory;
  if (updates.stock_scheduled !== undefined) dbUpdates.stock_scheduled = updates.stock_scheduled;
  if (updates.stock_full !== undefined) dbUpdates.stock_full = updates.stock_full;

  const { error } = await supabase
    .from('products')
    .update(dbUpdates)
    .eq('id', productId);

  if (error) throw error;
};

// --- BATCHES ---

export const getBatches = async (userId: string): Promise<Batch[]> => {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('user_id', userId)
    .order('sent_date', { ascending: false });

  if (error) {
    console.error('Error fetching batches:', error);
    return [];
  }

  return data.map((b: any) => ({
    id: b.id,
    items: b.items || [], 
    total_quantity: b.quantity,
    status: b.status,
    sent_date: b.sent_date,
    received_date: b.received_date
  }));
};

export const createBatch = async (userId: string, batch: Partial<Batch>) => {
  const { data, error } = await supabase
    .from('batches')
    .insert([{
      user_id: userId,
      quantity: batch.total_quantity,
      status: batch.status,
      sent_date: batch.sent_date,
      items: batch.items 
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateBatchStatus = async (batchId: string, status: string, receivedDate?: string) => {
  const updates: any = { status };
  if (receivedDate) updates.received_date = receivedDate;

  const { error } = await supabase
    .from('batches')
    .update(updates)
    .eq('id', batchId);

  if (error) throw error;
};

// --- SETTINGS ---

export const getUserSettings = async (userId: string): Promise<UserSettings> => {
  const { data, error } = await supabase
    .from('users')
    .select('ml_user_id, ml_access_token, alert_threshold')
    .eq('id', userId)
    .single();

  if (error) return { is_connected_ml: false, alert_threshold_days: 5 };

  return {
    is_connected_ml: !!data.ml_access_token,
    ml_user_id: data.ml_user_id,
    alert_threshold_days: data.alert_threshold || 5,
    last_sync: undefined 
  };
};

export const updateUserSettings = async (userId: string, settings: UserSettings) => {
  const { error } = await supabase
    .from('users')
    .update({
      alert_threshold: settings.alert_threshold_days,
    })
    .eq('id', userId);
    
  if (error) throw error;
};

export const updateUserTokens = async (userId: string, mlUserId: string, accessToken: string, refreshToken: string) => {
  const { error } = await supabase
    .from('users')
    .update({
      ml_user_id: mlUserId,
      ml_access_token: accessToken,
      ml_refresh_token: refreshToken,
    })
    .eq('id', userId);

  if (error) throw error;
};

// --- HELPERS ---

const calculateAvgSales = (history: any[]) => {
  if (!history || history.length === 0) return 0;
  const total = history.reduce((acc, curr) => acc + curr.quantity_sold, 0);
  return total / (history.length || 1);
};