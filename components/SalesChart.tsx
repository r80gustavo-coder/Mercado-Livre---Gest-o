
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Product } from '../types';

interface SalesChartProps {
  products: Product[];
}

const SalesChart: React.FC<SalesChartProps> = ({ products }) => {
  // Aggregate sales by date across all products
  const salesByDate: Record<string, number> = {};
  
  // Initialize last 30 days with 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0];
    salesByDate[d] = 0;
  }

  products.forEach(p => {
    p.sales_history.forEach(s => {
      if (salesByDate[s.date] !== undefined) {
        salesByDate[s.date] += s.quantity;
      }
    });
  });

  const data = Object.keys(salesByDate).map(date => ({
    date: date.split('-').slice(1).join('/'), // MM/DD format
    vendas: salesByDate[date]
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 12, fill: '#6b7280'}} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{fontSize: 12, fill: '#6b7280'}} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Bar dataKey="vendas" fill="#2d3277" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SalesChart;
