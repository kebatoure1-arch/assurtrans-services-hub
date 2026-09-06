// Anti-Fraud Service - Detect and prevent fraudulent activities
// Sprint 2 Implementation

import { table } from '@devvai/devv-code-backend';

const TRANSACTIONS_TABLE_ID = 'f4f186qchmgw';
const ACTIVITY_LOGS_TABLE_ID = 'f4eyoj5ij0n4';

export interface FraudCheck {
  suspicious: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  recommendedAction: 'allow' | 'review' | 'block';
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
}

// In-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, {
  count: number;
  resetAt: number;
}>();

/**
 * Check for fraudulent patterns
 */
export async function checkFraudulentActivity(
  userId: string,
  orderId: string,
  amount: number,
  stationId: string
): Promise<FraudCheck> {
  const reasons: string[] = [];
  let riskLevel: FraudCheck['riskLevel'] = 'low';

  try {
    // Check 1: Multiple validation attempts
    const recentAttempts = await getRecentValidationAttempts(userId);
    if (recentAttempts > 5) {
      reasons.push(`Tentatives de validation multiples: ${recentAttempts} en 10 minutes`);
      riskLevel = 'medium';
    }

    // Check 2: Unusual transaction amount
    const avgAmount = await getAverageTransactionAmount(userId);
    if (amount > avgAmount * 3) {
      reasons.push(`Montant inhabituel: ${amount} FCFA (moyenne: ${avgAmount} FCFA)`);
      if (riskLevel === 'low') {
        riskLevel = 'medium';
      }
    }

    // Check 3: Multiple stations in short time
    const recentStations = await getRecentStations(userId);
    if (recentStations.length > 3) {
      reasons.push(`Utilisation de ${recentStations.length} stations différentes en 24h`);
      riskLevel = 'high';
    }

    // Check 4: Late night transactions (22h-6h)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      reasons.push('Transaction en horaire inhabituel (22h-6h)');
      if (riskLevel === 'low') {
        riskLevel = 'medium';
      }
    }

    // Determine recommended action
    const suspicious = reasons.length > 0;
    const recommendedAction: 'allow' | 'review' | 'block' = 
      riskLevel === 'high' ? 'review' : 'allow';

    return {
      suspicious,
      riskLevel,
      reasons,
      recommendedAction,
    };

  } catch (error) {
    console.error('Fraud check failed:', error);
    // Fail-safe: Allow transaction but log error
    return {
      suspicious: false,
      riskLevel: 'low',
      reasons: ['Échec vérification anti-fraude (fail-safe)'],
      recommendedAction: 'allow',
    };
  }
}

/**
 * Rate limiting - Prevent spam and abuse
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 10,
  windowMinutes: number = 60
): RateLimitCheck {
  const now = Date.now();
  const key = `ratelimit:${identifier}`;
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    // Create new window
    entry = {
      count: 0,
      resetAt: now + windowMinutes * 60 * 1000,
    };
    rateLimitStore.set(key, entry);
  }

  // Increment counter
  entry.count++;

  // Check if exceeded
  if (entry.count > maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
      reason: `Trop de tentatives (${entry.count}/${maxAttempts}). Réessayez plus tard.`,
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Log security event
 */
export async function logSecurityEvent(event: {
  userId: string;
  eventType: 'qr_validation' | 'rate_limit_exceeded' | 'fraud_detected' | 'unauthorized_access';
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await table.addItem(ACTIVITY_LOGS_TABLE_ID, {
      userId: event.userId,
      action: event.eventType,
      severity: event.severity,
      details: event.details,
      metadata: JSON.stringify(event.metadata || {}),
      timestamp: new Date().toISOString(),
    });

    console.log(`🔒 Security event logged: ${event.eventType} (${event.severity})`);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Get recent validation attempts (last 10 minutes)
 */
async function getRecentValidationAttempts(userId: string): Promise<number> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const result = await table.getItems(ACTIVITY_LOGS_TABLE_ID, {
      query: { userId },
    });

    const logs = (result.items || []) as any[];
    const recentAttempts = logs.filter(log => 
      log.action === 'qr_validation' && 
      log.timestamp > tenMinutesAgo
    );

    return recentAttempts.length;
  } catch (error) {
    console.error('Failed to get recent attempts:', error);
    return 0;
  }
}

/**
 * Get average transaction amount for user
 */
async function getAverageTransactionAmount(userId: string): Promise<number> {
  try {
    const result = await table.getItems(TRANSACTIONS_TABLE_ID, {
      query: { userId },
    });

    const transactions = (result.items || []) as any[];
    
    if (transactions.length === 0) return 50000; // Default average

    const total = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    return total / transactions.length;
  } catch (error) {
    console.error('Failed to get average amount:', error);
    return 50000;
  }
}

/**
 * Get recent stations used (last 24 hours)
 */
async function getRecentStations(userId: string): Promise<string[]> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const result = await table.getItems(ACTIVITY_LOGS_TABLE_ID, {
      query: { userId },
    });

    const logs = (result.items || []) as any[];
    const recentLogs = logs.filter(log => 
      log.action === 'qr_validation' && 
      log.timestamp > oneDayAgo &&
      log.metadata
    );

    const stations = recentLogs
      .map(log => {
        try {
          const metadata = JSON.parse(log.metadata);
          return metadata.stationId;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Return unique stations
    return [...new Set(stations)];
  } catch (error) {
    console.error('Failed to get recent stations:', error);
    return [];
  }
}

/**
 * Clear rate limit cache (for testing)
 */
export function clearRateLimitCache(): void {
  rateLimitStore.clear();
}
