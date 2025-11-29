export interface Product {
  id: string;
  sku: string;
  title: string;
  image_url: string;
  cost_per_unit: number;
  stock_factory: number;
  stock_scheduled: number;
  stock_full: number;
  avg_daily_sales: number;
  sales_history: Sale[];
  ml_item_id?: string;
  user_id?: string;
}

export interface Sale {
  date: string;
  quantity: number;
}

export type BatchStatus = 'PREPARING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface BatchItem {
  product_id: string;
  product_title: string;
  quantity: number;
}

export interface Batch {
  id: string;
  items: BatchItem[];
  total_quantity: number;
  status: BatchStatus;
  sent_date: string;
  received_date?: string;
}

export interface DashboardStats {
  totalFull: number;
  totalFactory: number;
  salesToday: number;
  ruptureAlerts: number;
}

export interface RupturePrediction {
  daysLeft: number;
  status: 'CRITICAL' | 'WARNING' | 'HEALTHY';
}

export interface UserSettings {
  is_connected_ml: boolean;
  ml_user_id?: string;
  alert_threshold_days: number;
  last_sync?: string;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  PRODUCTS = 'PRODUCTS',
  FACTORY = 'FACTORY',
  BATCHES = 'BATCHES',
  SETTINGS = 'SETTINGS'
}