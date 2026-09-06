/**
 * Loyalty Distribution Chart - Display loyalty tiers distribution
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LoyaltyData } from '../types';

interface LoyaltyDistributionChartProps {
  data: LoyaltyData[];
}

const COLORS = [
  'hsl(25 60% 50%)',    // Bronze
  'hsl(0 0% 60%)',      // Silver
  'hsl(45 95% 45%)',    // Gold
  'hsl(170 22% 55%)',   // Platinum
  'hsl(240 50% 50%)',   // Diamond
];

export default function LoyaltyDistributionChart({ data }: LoyaltyDistributionChartProps) {
  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle>Distribution Fidélité</CardTitle>
        <CardDescription>Répartition des membres par palier</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ tier, members, percent }) => 
                `${tier}: ${members} (${(percent * 100).toFixed(0)}%)`
              }
              outerRadius={100}
              fill="#8884d8"
              dataKey="members"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
