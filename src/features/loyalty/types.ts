// Loyalty Rewards Types

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyAccount {
  _id: string;
  _uid: string;
  user_id: string;
  total_points: number;
  available_points: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  tier_progress: number;
  next_tier: string;
  points_to_next_tier: number;
  created_at: string;
  updated_at: string;
}

export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'expired' | 'adjusted';
export type LoyaltyTransactionSource = 'fuel_purchase' | 'insurance_payment' | 'referral' | 'bonus' | 'redemption';

export interface LoyaltyTransaction {
  _id: string;
  _uid: string;
  user_id: string;
  type: LoyaltyTransactionType;
  points: number;
  source: LoyaltyTransactionSource;
  reference_id?: string;
  description: string;
  balance_after: number;
  created_at: string;
}

export type RewardCategory = 'fuel_discount' | 'service_discount' | 'cash_voucher' | 'premium_upgrade' | 'insurance_benefit';
export type ValueType = 'percentage' | 'fixed_amount';

export interface LoyaltyReward {
  _id: string;
  _uid: string;
  name: string;
  description: string;
  points_required: number;
  category: RewardCategory;
  value: number;
  value_type: ValueType;
  tier_required?: string; // LoyaltyTier or empty string
  stock: number; // -1 for unlimited
  is_active: string; // 'true' or 'false'
  image_url?: string;
  terms?: string;
  created_at: string;
}

export type RedemptionStatus = 'pending' | 'approved' | 'delivered' | 'cancelled';

export interface LoyaltyRedemption {
  _id: string;
  _uid: string;
  user_id: string;
  reward_id: string;
  reward_name: string;
  points_spent: number;
  status: RedemptionStatus;
  voucher_code: string;
  expiry_date: string;
  used_date?: string;
  notes?: string;
  created_at: string;
}

// Tier configuration
export interface TierConfig {
  name: LoyaltyTier;
  minPoints: number;
  maxPoints: number;
  color: string;
  benefits: string[];
  icon: string;
}

export const TIER_CONFIGS: Record<LoyaltyTier, TierConfig> = {
  bronze: {
    name: 'bronze',
    minPoints: 0,
    maxPoints: 999,
    color: '#CD7F32',
    benefits: ['1 point per 100 FCFA', 'Récompenses de base', 'Support standard'],
    icon: '🥉'
  },
  silver: {
    name: 'silver',
    minPoints: 1000,
    maxPoints: 4999,
    color: '#C0C0C0',
    benefits: ['1.5 points par 100 FCFA', 'Récompenses améliorées', 'Support prioritaire'],
    icon: '🥈'
  },
  gold: {
    name: 'gold',
    minPoints: 5000,
    maxPoints: 14999,
    color: '#FFD700',
    benefits: ['2 points par 100 FCFA', 'Récompenses premium', 'Support VIP', 'Bonus mensuels'],
    icon: '🥇'
  },
  platinum: {
    name: 'platinum',
    minPoints: 15000,
    maxPoints: Infinity,
    color: '#E5E4E2',
    benefits: ['3 points par 100 FCFA', 'Toutes les récompenses', 'Support dédié', 'Bonus exclusifs', 'Accès anticipé'],
    icon: '💎'
  }
};

// Points earning rules
export const POINTS_RULES = {
  fuel_purchase: {
    bronze: 1, // points per 100 FCFA
    silver: 1.5,
    gold: 2,
    platinum: 3
  },
  insurance_payment: {
    bronze: 0.5,
    silver: 0.75,
    gold: 1,
    platinum: 1.5
  },
  referral: 500, // Fixed points for successful referral
  signup_bonus: 100 // Welcome bonus
};
