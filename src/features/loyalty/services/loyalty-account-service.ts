import { table } from '@devvai/devv-code-backend';
import type { LoyaltyAccount, LoyaltyTier, LoyaltyTransaction, LoyaltyTransactionSource, LoyaltyTransactionType } from '../types';
import { TIER_CONFIGS, POINTS_RULES } from '../types';

const LOYALTY_ACCOUNTS_TABLE_ID = 'f4f6sysp3gn4';
const LOYALTY_TRANSACTIONS_TABLE_ID = 'f4f6sysk3ny8';

// Get or create loyalty account for user
export async function getOrCreateLoyaltyAccount(userId: string): Promise<LoyaltyAccount | null> {
  try {
    // Try to get existing account
    const response = await table.getItems(LOYALTY_ACCOUNTS_TABLE_ID, {
      query: { user_id: userId },
      limit: 1
    });

    if (response.items && response.items.length > 0) {
      return response.items[0] as LoyaltyAccount;
    }

    // Create new account with welcome bonus
    const now = new Date().toISOString();
    const newAccount: Omit<LoyaltyAccount, '_id' | '_uid'> = {
      user_id: userId,
      total_points: POINTS_RULES.signup_bonus,
      available_points: POINTS_RULES.signup_bonus,
      lifetime_points: POINTS_RULES.signup_bonus,
      tier: 'bronze',
      tier_progress: calculateTierProgress(POINTS_RULES.signup_bonus, 'bronze'),
      next_tier: 'silver',
      points_to_next_tier: TIER_CONFIGS.silver.minPoints - POINTS_RULES.signup_bonus,
      created_at: now,
      updated_at: now
    };

    await table.addItem(LOYALTY_ACCOUNTS_TABLE_ID, newAccount);

    // Record welcome bonus transaction
    await addLoyaltyTransaction(
      userId,
      'earned',
      POINTS_RULES.signup_bonus,
      'bonus',
      'Bonus de bienvenue',
      POINTS_RULES.signup_bonus
    );

    // Fetch the created account
    const newResponse = await table.getItems(LOYALTY_ACCOUNTS_TABLE_ID, {
      query: { user_id: userId },
      limit: 1
    });

    return newResponse.items && newResponse.items.length > 0 
      ? (newResponse.items[0] as LoyaltyAccount) 
      : null;
  } catch (error) {
    console.error('Error getting/creating loyalty account:', error);
    return null;
  }
}

// Calculate tier based on lifetime points
export function calculateTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= TIER_CONFIGS.platinum.minPoints) return 'platinum';
  if (lifetimePoints >= TIER_CONFIGS.gold.minPoints) return 'gold';
  if (lifetimePoints >= TIER_CONFIGS.silver.minPoints) return 'silver';
  return 'bronze';
}

// Calculate tier progress (0-100)
export function calculateTierProgress(lifetimePoints: number, tier: LoyaltyTier): number {
  const config = TIER_CONFIGS[tier];
  if (tier === 'platinum') return 100; // Max tier
  
  const pointsInTier = lifetimePoints - config.minPoints;
  const tierRange = config.maxPoints - config.minPoints + 1;
  return Math.min(100, Math.round((pointsInTier / tierRange) * 100));
}

// Get next tier info
export function getNextTierInfo(tier: LoyaltyTier, lifetimePoints: number): { nextTier: string; pointsNeeded: number } {
  const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tiers.indexOf(tier);
  
  if (currentIndex === tiers.length - 1) {
    return { nextTier: '', pointsNeeded: 0 }; // Already at max tier
  }
  
  const nextTier = tiers[currentIndex + 1];
  const pointsNeeded = TIER_CONFIGS[nextTier].minPoints - lifetimePoints;
  
  return { nextTier, pointsNeeded: Math.max(0, pointsNeeded) };
}

// Add loyalty transaction
export async function addLoyaltyTransaction(
  userId: string,
  type: LoyaltyTransactionType,
  points: number,
  source: LoyaltyTransactionSource,
  description: string,
  balanceAfter: number,
  referenceId?: string
): Promise<void> {
  try {
    const transaction: Omit<LoyaltyTransaction, '_id' | '_uid'> = {
      user_id: userId,
      type,
      points,
      source,
      reference_id: referenceId,
      description,
      balance_after: balanceAfter,
      created_at: new Date().toISOString()
    };

    await table.addItem(LOYALTY_TRANSACTIONS_TABLE_ID, transaction);
  } catch (error) {
    console.error('Error adding loyalty transaction:', error);
    throw error;
  }
}

// Award points for fuel purchase
export async function awardFuelPurchasePoints(
  userId: string,
  amount: number,
  orderId: string
): Promise<{ pointsEarned: number; newBalance: number } | null> {
  try {
    const account = await getOrCreateLoyaltyAccount(userId);
    if (!account) return null;

    // Calculate points based on tier (per 100 FCFA)
    const multiplier = POINTS_RULES.fuel_purchase[account.tier];
    const pointsEarned = Math.floor((amount / 100) * multiplier);

    if (pointsEarned === 0) return null;

    // Update account
    const newTotalPoints = account.total_points + pointsEarned;
    const newAvailablePoints = account.available_points + pointsEarned;
    const newLifetimePoints = account.lifetime_points + pointsEarned;
    const newTier = calculateTier(newLifetimePoints);
    const tierChanged = newTier !== account.tier;
    const { nextTier, pointsNeeded } = getNextTierInfo(newTier, newLifetimePoints);

    await table.updateItem(LOYALTY_ACCOUNTS_TABLE_ID, {
      _uid: account._uid,
      _id: account._id,
      total_points: newTotalPoints,
      available_points: newAvailablePoints,
      lifetime_points: newLifetimePoints,
      tier: newTier,
      tier_progress: calculateTierProgress(newLifetimePoints, newTier),
      next_tier: nextTier,
      points_to_next_tier: pointsNeeded,
      updated_at: new Date().toISOString()
    });

    // Record transaction
    await addLoyaltyTransaction(
      userId,
      'earned',
      pointsEarned,
      'fuel_purchase',
      `Points gagnés pour achat de carburant (${amount} FCFA)`,
      newAvailablePoints,
      orderId
    );

    // Award tier upgrade bonus if applicable
    if (tierChanged && newTier !== 'bronze') {
      const bonusPoints = newTier === 'silver' ? 200 : newTier === 'gold' ? 500 : 1000;
      await awardBonusPoints(
        userId,
        bonusPoints,
        `Bonus de passage au niveau ${newTier.toUpperCase()}`
      );
    }

    return { pointsEarned, newBalance: newAvailablePoints };
  } catch (error) {
    console.error('Error awarding fuel purchase points:', error);
    return null;
  }
}

// Award points for insurance payment
export async function awardInsurancePaymentPoints(
  userId: string,
  amount: number,
  policyId: string
): Promise<{ pointsEarned: number; newBalance: number } | null> {
  try {
    const account = await getOrCreateLoyaltyAccount(userId);
    if (!account) return null;

    const multiplier = POINTS_RULES.insurance_payment[account.tier];
    const pointsEarned = Math.floor((amount / 100) * multiplier);

    if (pointsEarned === 0) return null;

    const newTotalPoints = account.total_points + pointsEarned;
    const newAvailablePoints = account.available_points + pointsEarned;
    const newLifetimePoints = account.lifetime_points + pointsEarned;
    const newTier = calculateTier(newLifetimePoints);
    const { nextTier, pointsNeeded } = getNextTierInfo(newTier, newLifetimePoints);

    await table.updateItem(LOYALTY_ACCOUNTS_TABLE_ID, {
      _uid: account._uid,
      _id: account._id,
      total_points: newTotalPoints,
      available_points: newAvailablePoints,
      lifetime_points: newLifetimePoints,
      tier: newTier,
      tier_progress: calculateTierProgress(newLifetimePoints, newTier),
      next_tier: nextTier,
      points_to_next_tier: pointsNeeded,
      updated_at: new Date().toISOString()
    });

    await addLoyaltyTransaction(
      userId,
      'earned',
      pointsEarned,
      'insurance_payment',
      `Points gagnés pour paiement d'assurance (${amount} FCFA)`,
      newAvailablePoints,
      policyId
    );

    return { pointsEarned, newBalance: newAvailablePoints };
  } catch (error) {
    console.error('Error awarding insurance payment points:', error);
    return null;
  }
}

// Award bonus points
export async function awardBonusPoints(
  userId: string,
  points: number,
  description: string
): Promise<boolean> {
  try {
    const account = await getOrCreateLoyaltyAccount(userId);
    if (!account) return false;

    const newTotalPoints = account.total_points + points;
    const newAvailablePoints = account.available_points + points;
    const newLifetimePoints = account.lifetime_points + points;
    const newTier = calculateTier(newLifetimePoints);
    const { nextTier, pointsNeeded } = getNextTierInfo(newTier, newLifetimePoints);

    await table.updateItem(LOYALTY_ACCOUNTS_TABLE_ID, {
      _uid: account._uid,
      _id: account._id,
      total_points: newTotalPoints,
      available_points: newAvailablePoints,
      lifetime_points: newLifetimePoints,
      tier: newTier,
      tier_progress: calculateTierProgress(newLifetimePoints, newTier),
      next_tier: nextTier,
      points_to_next_tier: pointsNeeded,
      updated_at: new Date().toISOString()
    });

    await addLoyaltyTransaction(
      userId,
      'earned',
      points,
      'bonus',
      description,
      newAvailablePoints
    );

    return true;
  } catch (error) {
    console.error('Error awarding bonus points:', error);
    return false;
  }
}

// Deduct points for redemption
export async function deductPoints(
  userId: string,
  points: number,
  description: string,
  redemptionId: string
): Promise<boolean> {
  try {
    const account = await getOrCreateLoyaltyAccount(userId);
    if (!account || account.available_points < points) return false;

    const newTotalPoints = account.total_points - points;
    const newAvailablePoints = account.available_points - points;

    await table.updateItem(LOYALTY_ACCOUNTS_TABLE_ID, {
      _uid: account._uid,
      _id: account._id,
      total_points: newTotalPoints,
      available_points: newAvailablePoints,
      updated_at: new Date().toISOString()
    });

    await addLoyaltyTransaction(
      userId,
      'redeemed',
      -points,
      'redemption',
      description,
      newAvailablePoints,
      redemptionId
    );

    return true;
  } catch (error) {
    console.error('Error deducting points:', error);
    return false;
  }
}

// Get user transactions
export async function getUserTransactions(userId: string, limit = 50): Promise<LoyaltyTransaction[]> {
  try {
    const response = await table.getItems(LOYALTY_TRANSACTIONS_TABLE_ID, {
      query: { user_id: userId },
      limit,
      sort: '_id',
      order: 'desc'
    });

    return (response.items || []) as LoyaltyTransaction[];
  } catch (error) {
    console.error('Error getting user transactions:', error);
    return [];
  }
}

// Get leaderboard (top users by lifetime points)
export async function getLeaderboard(limit = 10): Promise<LoyaltyAccount[]> {
  try {
    const response = await table.getItems(LOYALTY_ACCOUNTS_TABLE_ID, { limit: 100 });
    const accounts = (response.items || []) as LoyaltyAccount[];
    
    // Sort by lifetime points descending
    return accounts
      .sort((a, b) => b.lifetime_points - a.lifetime_points)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}
