/**
 * Insurance Analytics Chart - Display insurance metrics
 */

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InsuranceData } from '../types';

interface InsuranceAnalyticsChartProps {
  data: InsuranceData[];
}

export default function InsuranceAnalyticsChart({ data }: InsuranceAnalyticsChartProps) {
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
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle>Analyse Assurance Santé</CardTitle>
        <CardDescription>Polices, sinistres et primes collectées</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              yAxisId="left"
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tickFormatter={formatCurrency}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name.includes('Montant') || name.includes('Primes')) {
                  return formatCurrency(value);
                }
                return value;
              }}
              labelFormatter={formatDate}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="policies" 
              name="Nouvelles polices" 
              fill="hsl(var(--primary))"
            />
            <Bar 
              yAxisId="left"
              dataKey="claims" 
              name="Nouveaux sinistres" 
              fill="hsl(var(--warning))"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="premiumsCollected"
              name="Primes collectées"
              stroke="hsl(142 76% 36%)"
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="claimsAmount"
              name="Montant des sinistres"
              stroke="hsl(0 84% 60%)"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
