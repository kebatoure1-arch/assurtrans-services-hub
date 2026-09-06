/**
 * User Growth Chart - Display user registration trends by role
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserGrowthData } from '../types';

interface UserGrowthChartProps {
  data: UserGrowthData[];
}

export default function UserGrowthChart({ data }: UserGrowthChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle>Croissance des utilisateurs</CardTitle>
        <CardDescription>Nouveaux utilisateurs par rôle</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
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
            <Line
              type="monotone"
              dataKey="drivers"
              name="Chauffeurs"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))' }}
            />
            <Line
              type="monotone"
              dataKey="fleets"
              name="Flottes"
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--secondary))' }}
            />
            <Line
              type="monotone"
              dataKey="stations"
              name="Stations"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--accent))' }}
            />
            <Line
              type="monotone"
              dataKey="petroliers"
              name="Pétroliers"
              stroke="hsl(200 50% 55%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(200 50% 55%)' }}
            />
            <Line
              type="monotone"
              dataKey="agents"
              name="Agents"
              stroke="hsl(142 76% 36%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(142 76% 36%)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
