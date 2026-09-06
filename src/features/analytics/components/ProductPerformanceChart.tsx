/**
 * Product Performance Chart - Display top performing products
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProductPerformanceData } from '../types';

interface ProductPerformanceChartProps {
  data: ProductPerformanceData[];
}

export default function ProductPerformanceChart({ data }: ProductPerformanceChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle>Performance des produits</CardTitle>
        <CardDescription>Top 10 produits par revenus</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number" 
              tickFormatter={formatCurrency}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              dataKey="productName" 
              type="category" 
              width={120}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip 
              formatter={formatCurrency}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar 
              dataKey="revenue" 
              name="Revenus" 
              fill="hsl(var(--primary))"
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
