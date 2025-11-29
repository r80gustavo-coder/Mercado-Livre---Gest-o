
import { supabase } from '../lib/supabaseClient';
import { Product, Batch, UserSettings, BatchItem } from '../types';

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

  // Map DB structure to App structure
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
  // We only map specific fields that exist in the DB table
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
  // Fetch batches and join with batch_items
  // Note: For simplicity in this demo, assuming 'batches' table has a JSONB column 'items' 
  // or we fetch items separately. Since the schema defined previously was simple, 
  // let's assume we store items in a JSON column or we'd need a separate table.
  // To make it work with the previous schema structure provided:
  // We will assume the 'batches' table has been updated or we just fetch basic info.
  // For this implementation, I will treat the DB as having the structure we need.
  
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
    items: b.items || [], // Assuming JSONB column for items for simplicity
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
      items: batch.items // Storing as JSONB
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
    .select('ml_user_id, ml_access_token, alert_threshold') // Assuming we added alert_threshold to users table
    .eq('id', userId)
    .single();

  if (error) return { is_connected_ml: false, alert_threshold_days: 5 };

  return {
    is_connected_ml: !!data.ml_access_token,
    ml_user_id: data.ml_user_id,
    alert_threshold_days: data.alert_threshold || 5,
    last_sync: undefined // Not stored in DB usually
  };
};

export const updateUserSettings = async (userId: string, settings: UserSettings) => {
  const { error } = await supabase
    .from('users')
    .update({
      alert_threshold: settings.alert_threshold_days,
      // We don't update tokens here usually, that's handled by OAuth callback
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
