import { Product, RupturePrediction } from '../types';

export const calculateRupture = (stockFull: number, avgDailySales: number): RupturePrediction => {
  if (avgDailySales <= 0) {
    return { daysLeft: 999, status: 'HEALTHY' };
  }

  const daysLeft = Math.floor(stockFull / avgDailySales);

  let status: RupturePrediction['status'] = 'HEALTHY';
  if (daysLeft <= 5) {
    status = 'CRITICAL';
  } else if (daysLeft <= 15) {
    status = 'WARNING';
  }

  return { daysLeft, status };
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
    case 'WARNING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'HEALTHY': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};