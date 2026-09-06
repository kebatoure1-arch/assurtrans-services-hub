/**
 * Revenue Chart Component - Display revenue trends over time
 */

import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RevenueData } from '../types';

interface RevenueChartProps {
  data: RevenueData[];
  chartType?: 'line' | 'area';
}

export default function RevenueChart({ data, chartType = 'area' }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Revenus</CardTitle>
        <CardDescription>Évolution des revenus par source</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          {chartType === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorInsurance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip 
                formatter={formatCurrency}
                labelFormatter={formatDate}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="fuel"
                name="Carburant"
                stroke="hsl(var(--secondary))"
                fill="url(#colorFuel)"
              />
              <Area
                type="monotone"
                dataKey="insurance"
                name="Assurance"
                stroke="hsl(var(--accent))"
                fill="url(#colorInsurance)"
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip 
                formatter={formatCurrency}
                labelFormatter={formatDate}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenu total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="fuel"
                name="Carburant"
                stroke="hsl(var(--secondary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="insurance"
                name="Assurance"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
