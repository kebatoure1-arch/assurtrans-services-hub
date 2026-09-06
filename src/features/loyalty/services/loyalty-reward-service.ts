import { table } from '@devvai/devv-code-backend';
import type { LoyaltyReward, LoyaltyRedemption, RewardCategory, LoyaltyTier } from '../types';
import { deductPoints } from './loyalty-account-service';

const LOYALTY_REWARDS_TABLE_ID = 'f4f6sysf3oxs';
const LOYALTY_REDEMPTIONS_TABLE_ID = 'f4f6sysp3gn5';

// Get all active rewards
export async function getActiveRewards(tier?: LoyaltyTier): Promise<LoyaltyReward[]> {
  try {
    const response = await table.getItems(LOYALTY_REWARDS_TABLE_ID, {
      query: { is_active: 'true' },
      limit: 100
    });

    let rewards = (response.items || []) as LoyaltyReward[];

    // Filter by tier if provided
    if (tier) {
      const tierOrder: Record<LoyaltyTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
      const userTierLevel = tierOrder[tier];

      rewards = rewards.filter(reward => {
        const hasNoRequirement = !reward.tier_required || reward.tier_required === '';
        if (hasNoRequirement) return true;
        const requiredTierLevel = tierOrder[reward.tier_required as LoyaltyTier];
        return userTierLevel >= requiredTierLevel;
      });
    }

    // Sort by points required
    return rewards.sort((a, b) => a.points_required - b.points_required);
  } catch (error) {
    console.error('Error getting active rewards:', error);
    return [];
  }
}

// Get reward by ID
export async function getRewardById(rewardId: string): Promise<LoyaltyReward | null> {
  try {
    const response = await table.getItems(LOYALTY_REWARDS_TABLE_ID, {
      query: { _id: rewardId },
      limit: 1
    });
    return response.items && response.items.length > 0 ? (response.items[0] as LoyaltyReward) : null;
  } catch (error) {
    console.error('Error getting reward:', error);
    return null;
  }
}

// Create reward (Admin only)
export async function createReward(rewardData: Omit<LoyaltyReward, '_id' | '_uid' | 'created_at'>): Promise<void> {
  try {
    const newReward = {
      ...rewardData,
      created_at: new Date().toISOString()
    };

    await table.addItem(LOYALTY_REWARDS_TABLE_ID, newReward);
  } catch (error) {
    console.error('Error creating reward:', error);
    throw error;
  }
}

// Update reward (Admin only)
export async function updateReward(rewardId: string, rewardUid: string, updates: Partial<LoyaltyReward>): Promise<void> {
  try {
    await table.updateItem(LOYALTY_REWARDS_TABLE_ID, {
      _uid: rewardUid,
      _id: rewardId,
      ...updates
    });
  } catch (error) {
    console.error('Error updating reward:', error);
    throw error;
  }
}

// Generate unique voucher code
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AT-'; // Assur'Trans prefix
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Redeem reward
export async function redeemReward(
  userId: string,
  rewardId: string,
  userAvailablePoints: number
): Promise<{ success: boolean; message: string; voucher?: LoyaltyRedemption }> {
  try {
    const reward = await getRewardById(rewardId);
    
    if (!reward) {
      return { success: false, message: 'Récompense introuvable' };
    }

    if (reward.is_active !== 'true') {
      return { success: false, message: 'Récompense non disponible' };
    }

    if (reward.stock === 0) {
      return { success: false, message: 'Récompense épuisée' };
    }

    if (userAvailablePoints < reward.points_required) {
      return { success: false, message: 'Points insuffisants' };
    }

    // Generate voucher code
    const voucherCode = generateVoucherCode();
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days validity

    // Create redemption record
    const redemption: Omit<LoyaltyRedemption, '_id' | '_uid'> = {
      user_id: userId,
      reward_id: rewardId,
      reward_name: reward.name,
      points_spent: reward.points_required,
      status: 'approved',
      voucher_code: voucherCode,
      expiry_date: expiryDate.toISOString(),
      created_at: now.toISOString()
    };

    await table.addItem(LOYALTY_REDEMPTIONS_TABLE_ID, redemption);

    // Deduct points from user account
    const deducted = await deductPoints(
      userId,
      reward.points_required,
      `Échange: ${reward.name}`,
      voucherCode
    );

    if (!deducted) {
      return { success: false, message: 'Échec de la déduction des points' };
    }

    // Update reward stock if not unlimited
    if (reward.stock > 0) {
      await table.updateItem(LOYALTY_REWARDS_TABLE_ID, {
        _uid: reward._uid,
        _id: reward._id,
        stock: reward.stock - 1
      });
    }

    // Fetch the created redemption
    const response = await table.getItems(LOYALTY_REDEMPTIONS_TABLE_ID, {
      query: { voucher_code: voucherCode },
      limit: 1
    });

    const createdRedemption = response.items && response.items.length > 0 
      ? (response.items[0] as LoyaltyRedemption)
      : undefined;

    return {
      success: true,
      message: 'Récompense échangée avec succès!',
      voucher: createdRedemption
    };
  } catch (error) {
    console.error('Error redeeming reward:', error);
    return { success: false, message: 'Erreur lors de l\'échange' };
  }
}

// Get user redemptions
export async function getUserRedemptions(userId: string): Promise<LoyaltyRedemption[]> {
  try {
    const response = await table.getItems(LOYALTY_REDEMPTIONS_TABLE_ID, {
      query: { user_id: userId },
      limit: 50,
      sort: '_id',
      order: 'desc'
    });

    return (response.items || []) as LoyaltyRedemption[];
  } catch (error) {
    console.error('Error getting user redemptions:', error);
    return [];
  }
}

// Verify and use voucher
export async function useVoucher(voucherCode: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await table.getItems(LOYALTY_REDEMPTIONS_TABLE_ID, {
      query: { voucher_code: voucherCode },
      limit: 1
    });

    if (!response.items || response.items.length === 0) {
      return { success: false, message: 'Code voucher invalide' };
    }

    const redemption = response.items[0] as LoyaltyRedemption;

    if (redemption.used_date) {
      return { success: false, message: 'Voucher déjà utilisé' };
    }

    const expiryDate = new Date(redemption.expiry_date);
    if (expiryDate < new Date()) {
      return { success: false, message: 'Voucher expiré' };
    }

    // Mark as used
    await table.updateItem(LOYALTY_REDEMPTIONS_TABLE_ID, {
      _uid: redemption._uid,
      _id: redemption._id,
      used_date: new Date().toISOString()
    });

    return { success: true, message: 'Voucher validé avec succès' };
  } catch (error) {
    console.error('Error using voucher:', error);
    return { success: false, message: 'Erreur lors de la validation' };
  }
}

// Seed initial rewards catalog
export async function seedRewards(): Promise<void> {
  try {
    const rewards: Omit<LoyaltyReward, '_id' | '_uid' | 'created_at'>[] = [
      // Fuel discounts
      {
        name: '5% Réduction Carburant',
        description: 'Réduction de 5% sur votre prochain achat de carburant',
        points_required: 500,
        category: 'fuel_discount',
        value: 5,
        value_type: 'percentage',
        tier_required: '',
        stock: -1,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1545262810-77515befe149?w=400&h=300&fit=crop',
        terms: 'Valable 90 jours. Non cumulable avec d\'autres promotions.'
      },
      {
        name: '10% Réduction Carburant',
        description: 'Réduction de 10% sur votre prochain achat de carburant',
        points_required: 1000,
        category: 'fuel_discount',
        value: 10,
        value_type: 'percentage',
        tier_required: 'silver',
        stock: -1,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1545262810-77515befe149?w=400&h=300&fit=crop',
        terms: 'Valable 90 jours. Réservé aux membres Silver et plus.'
      },
      {
        name: '15% Réduction Carburant',
        description: 'Réduction de 15% sur votre prochain achat de carburant',
        points_required: 2000,
        category: 'fuel_discount',
        value: 15,
        value_type: 'percentage',
        tier_required: 'gold',
        stock: -1,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1545262810-77515befe149?w=400&h=300&fit=crop',
        terms: 'Valable 90 jours. Réservé aux membres Gold et Platinum.'
      },
      // Cash vouchers
      {
        name: 'Bon d\'achat 2000 FCFA',
        description: 'Bon d\'achat de 2000 FCFA utilisable pour tout achat',
        points_required: 1500,
        category: 'cash_voucher',
        value: 2000,
        value_type: 'fixed_amount',
        tier_required: '',
        stock: -1,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1607863680198-23d4b2565df0?w=400&h=300&fit=crop',
        terms: 'Valable 90 jours. Utilisable en plusieurs fois.'
      },
      {
        name: 'Bon d\'achat 5000 FCFA',
        description: 'Bon d\'achat de 5000 FCFA utilisable pour tout achat',
        points_required: 3500,
        category: 'cash_voucher',
        value: 5000,
        value_type: 'fixed_amount',
        tier_required: 'silver',
        stock: -1,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1607863680198-23d4b2565df0?w=400&h=300&fit=crop',
        terms: 'Valable 90 jours. Utilisable en plusieurs fois.'
      },
      {
        name: 'Bon d\'achat 10000 FCFA',
        description: 'Bon d\'achat de 10000 FCFA utilisable pour tout achat',
        points_required: 6500,
        category: 'cash_voucher',
        value: 10000,
        value_type: 'fixed_amount',
        tier_required: 'gold',
        stock: -1,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1607863680198-23d4b2565df0?w=400&h=300&fit=crop',
        terms: 'Valable 90 jours. Utilisable en plusieurs fois.'
      },
      // Service discounts
      {
        name: 'Vidange Gratuite',
        description: 'Service de vidange d\'huile moteur gratuit',
        points_required: 2500,
        category: 'service_discount',
        value: 100,
        value_type: 'percentage',
        tier_required: 'silver',
        stock: 50,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=300&fit=crop',
        terms: 'Valable 60 jours. Prendre RDV à la station.'
      },
      {
        name: 'Lavage Premium',
        description: 'Lavage extérieur et intérieur premium avec cirage',
        points_required: 1200,
        category: 'service_discount',
        value: 100,
        value_type: 'percentage',
        tier_required: '',
        stock: 100,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=400&h=300&fit=crop',
        terms: 'Valable 60 jours. Disponible dans les stations partenaires.'
      },
      // Insurance benefits
      {
        name: 'Surclassement Assurance',
        description: 'Upgrade gratuit vers plan supérieur pour 1 mois',
        points_required: 5000,
        category: 'insurance_benefit',
        value: 1,
        value_type: 'fixed_amount',
        tier_required: 'gold',
        stock: 20,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop',
        terms: 'Valable pour le mois suivant. Upgrade automatique.'
      },
      {
        name: 'Extension Couverture',
        description: 'Ajout d\'un bénéficiaire supplémentaire pour 3 mois',
        points_required: 3000,
        category: 'insurance_benefit',
        value: 3,
        value_type: 'fixed_amount',
        tier_required: 'silver',
        stock: 30,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop',
        terms: 'Valable 30 jours pour activation.'
      },
      // Premium upgrades
      {
        name: 'Accès VIP Lounge',
        description: 'Accès au salon VIP dans nos stations premium pour 1 mois',
        points_required: 4000,
        category: 'premium_upgrade',
        value: 1,
        value_type: 'fixed_amount',
        tier_required: 'gold',
        stock: 15,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
        terms: 'Accès illimité pendant 1 mois. WiFi et rafraîchissements inclus.'
      },
      {
        name: 'Service Prioritaire',
        description: 'File prioritaire dans toutes nos stations pour 6 mois',
        points_required: 8000,
        category: 'premium_upgrade',
        value: 6,
        value_type: 'fixed_amount',
        tier_required: 'platinum',
        stock: 10,
        is_active: 'true',
        image_url: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=400&h=300&fit=crop',
        terms: 'Service express garanti. Valable 6 mois.'
      }
    ];

    for (const reward of rewards) {
      await createReward(reward);
    }

    console.log('Rewards seeded successfully');
  } catch (error) {
    console.error('Error seeding rewards:', error);
    throw error;
  }
}
