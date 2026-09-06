/**
 * Order Trends Chart - Display order status distribution over time
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrderTrendData } from '../types';

interface OrderTrendsChartProps {
  data: OrderTrendData[];
}

export default function OrderTrendsChart({ data }: OrderTrendsChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle>Tendances des commandes</CardTitle>
        <CardDescription>Statut des commandes par jour</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              labelFormatter={formatDate}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar dataKey="pending" name="En attente" fill="hsl(38 92% 50%)" stackId="a" />
            <Bar dataKey="confirmed" name="Confirmées" fill="hsl(200 50% 55%)" stackId="a" />
            <Bar dataKey="delivered" name="Livrées" fill="hsl(142 76% 36%)" stackId="a" />
            <Bar dataKey="cancelled" name="Annulées" fill="hsl(0 84% 60%)" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
