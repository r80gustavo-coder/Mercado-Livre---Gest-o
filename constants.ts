import { Product, Batch } from './types';

// Mock Data to simulate Supabase/Mercado Livre API response
export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    sku: 'HEAD-BT-001',
    title: 'Headphone Bluetooth Noise Cancelling',
    image_url: 'https://picsum.photos/100/100?random=1',
    cost_per_unit: 45.00,
    stock_factory: 150,
    stock_scheduled: 0,
    stock_full: 12,
    avg_daily_sales: 3.5,
    sales_history: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      quantity: Math.floor(Math.random() * 6)
    }))
  },
  {
    id: '2',
    sku: 'MOUSE-GAMER-RGB',
    title: 'Mouse Gamer RGB 12000 DPI',
    image_url: 'https://picsum.photos/100/100?random=2',
    cost_per_unit: 22.50,
    stock_factory: 500,
    stock_scheduled: 50,
    stock_full: 120,
    avg_daily_sales: 8.2,
    sales_history: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      quantity: Math.floor(Math.random() * 12) + 2
    }))
  },
  {
    id: '3',
    sku: 'KEYBOARD-MECH',
    title: 'Teclado Mecânico Switch Blue',
    image_url: 'https://picsum.photos/100/100?random=3',
    cost_per_unit: 110.00,
    stock_factory: 20,
    stock_scheduled: 0,
    stock_full: 5,
    avg_daily_sales: 2.1,
    sales_history: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      quantity: Math.floor(Math.random() * 4)
    }))
  },
  {
    id: '4',
    sku: 'WEBCAM-1080P',
    title: 'Webcam Full HD 1080p com Microfone',
    image_url: 'https://picsum.photos/100/100?random=4',
    cost_per_unit: 85.00,
    stock_factory: 0,
    stock_scheduled: 10,
    stock_full: 45,
    avg_daily_sales: 1.5,
    sales_history: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      quantity: Math.floor(Math.random() * 3)
    }))
  }
];

export const MOCK_BATCHES: Batch[] = [
  {
    id: 'batch-001',
    items: [
      { product_id: '2', product_title: 'Mouse Gamer RGB 12000 DPI', quantity: 100 }
    ],
    total_quantity: 100,
    status: 'RECEIVED',
    sent_date: '2023-10-01',
    received_date: '2023-10-05'
  },
  {
    id: 'batch-002',
    items: [
       { product_id: '1', product_title: 'Headphone Bluetooth Noise Cancelling', quantity: 50 }
    ],
    total_quantity: 50,
    status: 'IN_TRANSIT',
    sent_date: '2023-10-25'
  }
];