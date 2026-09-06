import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { InsurancePlan } from '../types';

interface InsurancePlanCardProps {
  plan: InsurancePlan;
  onSelect: (plan: InsurancePlan) => void;
  selected?: boolean;
}

export function InsurancePlanCard({ plan, onSelect, selected }: InsurancePlanCardProps) {
  const getPlanBadgeColor = (type: string) => {
    switch (type) {
      case 'basic':
        return 'bg-blue-100 text-blue-700';
      case 'standard':
        return 'bg-green-100 text-green-700';
      case 'premium':
        return 'bg-purple-100 text-purple-700';
      case 'family':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card
      className={`p-6 transition-all duration-200 hover:shadow-lg ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <Badge className={getPlanBadgeColor(plan.planType)}>
            {plan.planType.toUpperCase()}
          </Badge>
          <h3 className="text-xl font-semibold mt-2">{plan.planName}</h3>
          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Pricing */}
        <div className="border-t border-b py-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-2xl font-bold text-primary">
                {plan.monthlyPremium.toLocaleString()} XOF
              </p>
              <p className="text-sm text-muted-foreground">par mois</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-muted-foreground">
                {plan.annualPremium.toLocaleString()} XOF
              </p>
              <p className="text-sm text-muted-foreground">par an</p>
            </div>
          </div>
        </div>

        {/* Coverage Details */}
        <div>
          <p className="font-medium mb-2">Couverture:</p>
          <div className="space-y-1">
            {plan.coverage.map((item, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="font-medium">{item.type}:</span> {item.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Couverture max</p>
            <p className="font-semibold">{plan.maxCoverage.toLocaleString()} XOF</p>
          </div>
          <div>
            <p className="text-muted-foreground">Franchise</p>
            <p className="font-semibold">{plan.deductible.toLocaleString()} XOF</p>
          </div>
          <div>
            <p className="text-muted-foreground">Dépendants</p>
            <p className="font-semibold">{plan.dependentsCovered}</p>
          </div>
        </div>

        {/* Benefits */}
        {plan.benefits.length > 0 && (
          <div>
            <p className="font-medium mb-2">Avantages:</p>
            <ul className="space-y-1">
              {plan.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Select Button */}
        <Button
          onClick={() => onSelect(plan)}
          className="w-full"
          variant={selected ? 'default' : 'outline'}
        >
          {selected ? 'Plan sélectionné' : 'Sélectionner ce plan'}
        </Button>
      </div>
    </Card>
  );
}
