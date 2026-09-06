# 🛠️ Exemples d'Implémentation — Assur'Trans©

**Guide Pratique avec Code Prêt à l'Emploi**  
Version: 1.0 | Date: 12/01/2025

---

## 📋 Table des Matières

1. [Sécurité QR Code (HMAC-SHA256)](#sécurité-qr-code-hmac-sha256)
2. [OTP Fallback System](#otp-fallback-system)
3. [Mode Offline TPE](#mode-offline-tpe)
4. [Réconciliation Financière](#réconciliation-financière)
5. [Système Anti-Fraude](#système-anti-fraude)
6. [Notifications Multi-Canal](#notifications-multi-canal)

---

## 🔐 Sécurité QR Code (HMAC-SHA256)

### Implémentation Complète

**1. Configuration** :

```typescript
// src/config/security.ts
export const SECURITY_CONFIG = {
  QR_SECRET_KEY: process.env.QR_SECRET_KEY || 'CHANGE_IN_PRODUCTION',
  QR_EXPIRATION_HOURS: 48, // 48 heures
  HMAC_ALGORITHM: 'sha256',
  ENCODING: 'hex'
};

// Vérification au démarrage
if (process.env.NODE_ENV === 'production' && SECURITY_CONFIG.QR_SECRET_KEY === 'CHANGE_IN_PRODUCTION') {
  throw new Error('QR_SECRET_KEY must be set in production');
}
```

---

**2. Service de Génération** :

```typescript
// src/services/qr-security-service.ts
import crypto from 'crypto';
import { SECURITY_CONFIG } from '@/config/security';

interface QRPayload {
  order_id: string;
  driver_id: string;
  driver_name: string;
  allocated_amount: number;
  product: string;
  vehicle: string;
  timestamp: number;
  expiration: number;
  validation_code: string;
}

export class QRSecurityService {
  /**
   * Génère un QR Code sécurisé avec signature HMAC
   */
  static generateSecureQRCode(payload: QRPayload): string {
    // 1. Calcul expiration
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + SECURITY_CONFIG.QR_EXPIRATION_HOURS);
    
    const qrData = {
      ...payload,
      timestamp: Date.now(),
      expiration: expirationDate.getTime()
    };

    // 2. Génération signature HMAC-SHA256
    const signature = this.generateHMAC(qrData);

    // 3. QR Code final
    const secureQR = {
      ...qrData,
      hash_signature: signature
    };

    return JSON.stringify(secureQR);
  }

  /**
   * Génère signature HMAC-SHA256
   */
  private static generateHMAC(data: QRPayload): string {
    const payload = JSON.stringify({
      order_id: data.order_id,
      driver_id: data.driver_id,
      allocated_amount: data.allocated_amount,
      timestamp: data.timestamp,
      expiration: data.expiration
    });

    return crypto
      .createHmac(SECURITY_CONFIG.HMAC_ALGORITHM, SECURITY_CONFIG.QR_SECRET_KEY)
      .update(payload)
      .digest(SECURITY_CONFIG.ENCODING);
  }

  /**
   * Valide un QR Code scanné
   */
  static async validateQRCode(qrDataString: string): Promise<{
    valid: boolean;
    reason?: string;
    qrData?: QRPayload & { hash_signature: string };
  }> {
    try {
      // 1. Parse JSON
      const qrData = JSON.parse(qrDataString);

      // 2. Vérification structure
      if (!qrData.order_id || !qrData.hash_signature) {
        return { valid: false, reason: 'invalid_structure' };
      }

      // 3. Extraction signature
      const { hash_signature, ...payload } = qrData;

      // 4. Recalcul signature
      const computedSignature = this.generateHMAC(payload);

      // 5. Comparaison signatures (timing-safe)
      const isValidSignature = crypto.timingSafeEqual(
        Buffer.from(hash_signature, SECURITY_CONFIG.ENCODING),
        Buffer.from(computedSignature, SECURITY_CONFIG.ENCODING)
      );

      if (!isValidSignature) {
        console.error('❌ QR Code signature mismatch', {
          order_id: qrData.order_id,
          expected: computedSignature,
          received: hash_signature
        });
        return { valid: false, reason: 'invalid_signature' };
      }

      // 6. Vérification expiration
      if (Date.now() > qrData.expiration) {
        const hoursExpired = Math.floor((Date.now() - qrData.expiration) / (1000 * 60 * 60));
        console.warn('⚠️ QR Code expired', {
          order_id: qrData.order_id,
          expired_hours_ago: hoursExpired
        });
        return { valid: false, reason: 'qr_code_expired' };
      }

      // 7. Vérification one-time use
      const isUsed = await this.checkQRCodeUsed(qrData.order_id);
      if (isUsed) {
        console.error('❌ QR Code already used', {
          order_id: qrData.order_id
        });
        return { valid: false, reason: 'qr_code_used' };
      }

      // 8. Tout est OK
      console.log('✅ QR Code validation successful', {
        order_id: qrData.order_id
      });

      return { valid: true, qrData };

    } catch (error) {
      console.error('❌ QR Code validation error', error);
      return { valid: false, reason: 'validation_error' };
    }
  }

  /**
   * Vérifie si un QR Code a déjà été utilisé
   */
  private static async checkQRCodeUsed(orderId: string): Promise<boolean> {
    // Vérification en base de données
    const order = await db.orders.findOne({ id: orderId });
    return order?.qr_code_used === true || order?.status === 'completed';
  }

  /**
   * Marque un QR Code comme utilisé
   */
  static async markQRCodeAsUsed(orderId: string): Promise<void> {
    await db.orders.update(
      { id: orderId },
      { 
        qr_code_used: true,
        qr_code_used_at: Date.now()
      }
    );
    console.log('🔒 QR Code marked as used', { order_id: orderId });
  }
}
```

---

**3. Intégration dans l'API** :

```typescript
// src/api/qr/validate.ts
import { Request, Response } from 'express';
import { QRSecurityService } from '@/services/qr-security-service';

export async function validateQRCodeEndpoint(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const { qr_data, validation_code } = req.body;

    // 1. Validation basique
    if (!qr_data || !validation_code) {
      return res.status(400).json({
        valid: false,
        error: 'missing_parameters',
        message: 'qr_data et validation_code requis'
      });
    }

    // 2. Validation sécurité (HMAC + expiration + one-time)
    const securityCheck = await QRSecurityService.validateQRCode(qr_data);

    if (!securityCheck.valid) {
      return res.status(403).json({
        valid: false,
        error: securityCheck.reason,
        message: getErrorMessage(securityCheck.reason)
      });
    }

    const qrData = securityCheck.qrData!;

    // 3. Validation code à 4 chiffres
    if (qrData.validation_code !== validation_code) {
      console.error('❌ Validation code mismatch', {
        order_id: qrData.order_id,
        expected: qrData.validation_code,
        received: validation_code
      });

      return res.status(403).json({
        valid: false,
        error: 'validation_code_mismatch',
        message: 'Code de validation incorrect'
      });
    }

    // 4. Vérification commande en base
    const order = await db.orders.findOne({ id: qrData.order_id });

    if (!order) {
      return res.status(404).json({
        valid: false,
        error: 'order_not_found',
        message: 'Commande introuvable'
      });
    }

    if (order.status !== 'pending' && order.status !== 'dispatched') {
      return res.status(400).json({
        valid: false,
        error: 'invalid_order_status',
        message: `Commande en statut ${order.status} (attendu: pending ou dispatched)`
      });
    }

    // 5. Vérification solde wallet
    const wallet = await db.wallets.findOne({ user_id: order.driver_id });

    if (!wallet || wallet.available < order.allocated_amount) {
      return res.status(400).json({
        valid: false,
        error: 'insufficient_balance',
        message: 'Solde insuffisant'
      });
    }

    // 6. Tout est OK - Réponse
    const responseTime = Date.now() - startTime;

    console.log('✅ QR Code validation successful', {
      order_id: qrData.order_id,
      response_time_ms: responseTime
    });

    return res.status(200).json({
      valid: true,
      order: {
        order_id: order.id,
        driver_name: qrData.driver_name,
        vehicle: qrData.vehicle,
        product: qrData.product,
        amount: order.allocated_amount,
        status: order.status
      },
      warnings: responseTime > 2000 ? ['Temps de réponse élevé'] : [],
      response_time_ms: responseTime
    });

  } catch (error) {
    console.error('❌ QR validation error', error);
    return res.status(500).json({
      valid: false,
      error: 'internal_error',
      message: 'Erreur serveur'
    });
  }
}

// Messages d'erreur localisés
function getErrorMessage(reason?: string): string {
  const messages: Record<string, string> = {
    invalid_structure: 'QR Code invalide (structure)',
    invalid_signature: 'QR Code invalide (signature)',
    qr_code_expired: 'QR Code expiré',
    qr_code_used: 'QR Code déjà utilisé',
    validation_error: 'Erreur de validation'
  };
  return messages[reason || ''] || 'Erreur inconnue';
}
```

---

## 📱 OTP Fallback System

### Implémentation Complète

**1. Service OTP** :

```typescript
// src/services/otp-service.ts
import crypto from 'crypto';
import bcrypt from 'bcrypt';

interface OTPRecord {
  id: string;
  order_id: string;
  otp_hash: string;
  created_at: number;
  expires_at: number;
  attempts: number;
  max_attempts: number;
  status: 'active' | 'used' | 'expired' | 'blocked';
}

export class OTPService {
  private static readonly OTP_LENGTH = 6;
  private static readonly OTP_EXPIRATION_MINUTES = 15;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly BCRYPT_ROUNDS = 10;

  /**
   * Génère un code OTP 6 chiffres
   */
  static generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Crée un OTP pour une commande
   */
  static async createOTP(orderId: string): Promise<{
    otp: string;
    otpId: string;
    expiresAt: number;
  }> {
    // 1. Génération code
    const otp = this.generateOTP();

    // 2. Hash sécurisé
    const otpHash = await bcrypt.hash(otp, this.BCRYPT_ROUNDS);

    // 3. Calcul expiration
    const now = Date.now();
    const expiresAt = now + (this.OTP_EXPIRATION_MINUTES * 60 * 1000);

    // 4. Sauvegarde en base
    const otpRecord: OTPRecord = {
      id: `OTP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      order_id: orderId,
      otp_hash: otpHash,
      created_at: now,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: this.MAX_ATTEMPTS,
      status: 'active'
    };

    await db.otps.insert(otpRecord);

    console.log('📱 OTP created', {
      otp_id: otpRecord.id,
      order_id: orderId,
      expires_at: new Date(expiresAt).toISOString()
    });

    // 5. Retour (OTP en clair UNIQUEMENT pour envoi SMS)
    return {
      otp,
      otpId: otpRecord.id,
      expiresAt
    };
  }

  /**
   * Valide un code OTP
   */
  static async validateOTP(orderId: string, inputOTP: string): Promise<{
    valid: boolean;
    reason?: string;
    attemptsRemaining?: number;
  }> {
    try {
      // 1. Récupération enregistrement
      const otpRecord = await db.otps.findOne({ 
        order_id: orderId,
        status: 'active'
      });

      if (!otpRecord) {
        console.warn('⚠️ OTP not found or inactive', { order_id: orderId });
        return { valid: false, reason: 'otp_not_found' };
      }

      // 2. Vérification expiration
      if (Date.now() > otpRecord.expires_at) {
        await db.otps.update({ id: otpRecord.id }, { status: 'expired' });
        console.warn('⚠️ OTP expired', {
          otp_id: otpRecord.id,
          order_id: orderId
        });
        return { valid: false, reason: 'otp_expired' };
      }

      // 3. Vérification tentatives
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await db.otps.update({ id: otpRecord.id }, { status: 'blocked' });
        console.error('❌ OTP blocked (max attempts)', {
          otp_id: otpRecord.id,
          order_id: orderId,
          attempts: otpRecord.attempts
        });
        return { valid: false, reason: 'otp_blocked' };
      }

      // 4. Comparaison hash (timing-safe via bcrypt)
      const isValid = await bcrypt.compare(inputOTP, otpRecord.otp_hash);

      if (!isValid) {
        // Incrémenter tentatives
        const newAttempts = otpRecord.attempts + 1;
        await db.otps.update({ id: otpRecord.id }, { attempts: newAttempts });

        console.warn('⚠️ Invalid OTP attempt', {
          otp_id: otpRecord.id,
          order_id: orderId,
          attempts: newAttempts,
          remaining: otpRecord.max_attempts - newAttempts
        });

        return {
          valid: false,
          reason: 'invalid_otp',
          attemptsRemaining: otpRecord.max_attempts - newAttempts
        };
      }

      // 5. OTP valide - Invalidation
      await db.otps.update({ id: otpRecord.id }, { status: 'used' });

      console.log('✅ OTP validation successful', {
        otp_id: otpRecord.id,
        order_id: orderId
      });

      return { valid: true };

    } catch (error) {
      console.error('❌ OTP validation error', error);
      return { valid: false, reason: 'validation_error' };
    }
  }

  /**
   * Envoie OTP par SMS
   */
  static async sendOTPBySMS(
    phone: string,
    otp: string,
    driverName: string
  ): Promise<boolean> {
    try {
      const message = `Assur'Trans - Code de validation: ${otp}\nValable 15 minutes.\nChauffeur: ${driverName}`;

      // Appel service SMS (Twilio, Africa's Talking, etc.)
      const result = await smsService.send({
        to: phone,
        message
      });

      if (result.success) {
        console.log('📲 OTP SMS sent', {
          phone,
          message_id: result.messageId
        });
        return true;
      } else {
        console.error('❌ OTP SMS failed', {
          phone,
          error: result.error
        });
        return false;
      }
    } catch (error) {
      console.error('❌ OTP SMS error', error);
      return false;
    }
  }

  /**
   * Nettoyage OTP expirés (cron quotidien)
   */
  static async cleanupExpiredOTPs(): Promise<number> {
    const result = await db.otps.deleteMany({
      expires_at: { $lt: Date.now() }
    });

    console.log('🧹 Expired OTPs cleaned', {
      deleted_count: result.deletedCount
    });

    return result.deletedCount;
  }
}
```

---

**2. Endpoint API** :

```typescript
// src/api/otp/generate.ts
export async function generateOTPEndpoint(req: Request, res: Response) {
  try {
    const { order_id } = req.body;

    // 1. Vérification commande
    const order = await db.orders.findOne({ id: order_id });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found'
      });
    }

    // 2. Récupération info chauffeur
    const driver = await db.user_profiles.findOne({ _uid: order.driver_id });

    if (!driver || !driver.phone) {
      return res.status(400).json({
        success: false,
        error: 'driver_phone_missing'
      });
    }

    // 3. Génération OTP
    const { otp, otpId, expiresAt } = await OTPService.createOTP(order_id);

    // 4. Envoi SMS
    const smsSent = await OTPService.sendOTPBySMS(
      driver.phone,
      otp,
      driver.firstName + ' ' + driver.lastName
    );

    if (!smsSent) {
      console.warn('⚠️ SMS failed but OTP created', { otp_id: otpId });
    }

    // 5. Réponse
    return res.status(200).json({
      success: true,
      otp_id: otpId,
      expires_at: expiresAt,
      sms_sent: smsSent,
      message: smsSent 
        ? 'OTP envoyé par SMS' 
        : 'OTP créé (envoi SMS échoué)'
    });

  } catch (error) {
    console.error('❌ OTP generation error', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error'
    });
  }
}

// src/api/otp/validate.ts
export async function validateOTPEndpoint(req: Request, res: Response) {
  try {
    const { order_id, otp } = req.body;

    if (!order_id || !otp) {
      return res.status(400).json({
        valid: false,
        error: 'missing_parameters'
      });
    }

    // Validation
    const result = await OTPService.validateOTP(order_id, otp);

    if (!result.valid) {
      return res.status(403).json({
        valid: false,
        error: result.reason,
        attempts_remaining: result.attemptsRemaining,
        message: getOTPErrorMessage(result.reason)
      });
    }

    return res.status(200).json({
      valid: true,
      message: 'OTP validé avec succès'
    });

  } catch (error) {
    console.error('❌ OTP validation error', error);
    return res.status(500).json({
      valid: false,
      error: 'internal_error'
    });
  }
}

function getOTPErrorMessage(reason?: string): string {
  const messages: Record<string, string> = {
    otp_not_found: 'Code OTP introuvable ou déjà utilisé',
    otp_expired: 'Code OTP expiré (15 minutes)',
    otp_blocked: 'Code OTP bloqué (3 tentatives échouées)',
    invalid_otp: 'Code OTP incorrect',
    validation_error: 'Erreur de validation'
  };
  return messages[reason || ''] || 'Erreur inconnue';
}
```

---

## 💾 Mode Offline TPE

### Implémentation Complète

**1. Configuration IndexedDB** :

```typescript
// src/lib/offline-db.ts
import Dexie, { Table } from 'dexie';

interface OfflineTransaction {
  id: string;
  qr_data: string;
  validation_code: string;
  scanned_at: number;
  station_id: string;
  pompiste_id: string;
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  synced: boolean;
  synced_at?: number;
  retry_count: number;
  error_message?: string;
}

class OfflineDatabase extends Dexie {
  transactions!: Table<OfflineTransaction, string>;

  constructor() {
    super('AssurTransOfflineDB');

    this.version(1).stores({
      transactions: 'id, scanned_at, status, synced, retry_count'
    });
  }
}

export const offlineDB = new OfflineDatabase();
```

---

**2. Service Offline** :

```typescript
// src/services/offline-service.ts
import { offlineDB } from '@/lib/offline-db';

export class OfflineService {
  /**
   * Sauvegarde transaction hors ligne
   */
  static async saveOfflineTransaction(
    qrData: string,
    validationCode: string,
    stationId: string,
    pompisteId: string
  ): Promise<string> {
    const txnId = `OFF-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await offlineDB.transactions.add({
      id: txnId,
      qr_data: qrData,
      validation_code: validationCode,
      scanned_at: Date.now(),
      station_id: stationId,
      pompiste_id: pompisteId,
      status: 'pending_sync',
      synced: false,
      retry_count: 0
    });

    console.log('💾 Offline transaction saved', {
      txn_id: txnId,
      station_id: stationId
    });

    return txnId;
  }

  /**
   * Récupère transactions en attente de sync
   */
  static async getPendingTransactions(): Promise<OfflineTransaction[]> {
    return await offlineDB.transactions
      .where('synced')
      .equals(false)
      .and(txn => txn.retry_count < 3)
      .toArray();
  }

  /**
   * Synchronise une transaction
   */
  static async syncTransaction(txnId: string): Promise<boolean> {
    try {
      const txn = await offlineDB.transactions.get(txnId);

      if (!txn) {
        console.error('❌ Transaction not found', { txn_id: txnId });
        return false;
      }

      // 1. Marquer comme "en cours de sync"
      await offlineDB.transactions.update(txnId, {
        status: 'syncing'
      });

      // 2. Appel API backend
      const response = await fetch('/api/orders/sync-offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          qr_data: txn.qr_data,
          validation_code: txn.validation_code,
          scanned_at: txn.scanned_at,
          station_id: txn.station_id,
          pompiste_id: txn.pompiste_id,
          local_txn_id: txn.id
        })
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();

      // 3. Succès - Marquer comme synchronisé
      await offlineDB.transactions.update(txnId, {
        status: 'synced',
        synced: true,
        synced_at: Date.now()
      });

      console.log('✅ Transaction synced', {
        txn_id: txnId,
        order_id: result.order_id
      });

      return true;

    } catch (error) {
      console.error('❌ Transaction sync error', {
        txn_id: txnId,
        error
      });

      // Incrémenter retry_count
      const txn = await offlineDB.transactions.get(txnId);
      if (txn) {
        const newRetryCount = txn.retry_count + 1;

        if (newRetryCount >= 3) {
          // Max tentatives atteint
          await offlineDB.transactions.update(txnId, {
            status: 'failed',
            retry_count: newRetryCount,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          });

          console.error('❌ Transaction sync failed (max retries)', {
            txn_id: txnId
          });
        } else {
          await offlineDB.transactions.update(txnId, {
            status: 'pending_sync',
            retry_count: newRetryCount
          });

          console.warn('⚠️ Transaction sync retry scheduled', {
            txn_id: txnId,
            retry_count: newRetryCount
          });
        }
      }

      return false;
    }
  }

  /**
   * Synchronise toutes les transactions en attente
   */
  static async syncAllPending(): Promise<{
    total: number;
    synced: number;
    failed: number;
  }> {
    const pending = await this.getPendingTransactions();

    let synced = 0;
    let failed = 0;

    for (const txn of pending) {
      const success = await this.syncTransaction(txn.id);
      if (success) {
        synced++;
      } else {
        failed++;
      }

      // Délai entre chaque sync (éviter surcharge serveur)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('📊 Sync summary', {
      total: pending.length,
      synced,
      failed
    });

    return { total: pending.length, synced, failed };
  }

  /**
   * Compte transactions en attente
   */
  static async getPendingCount(): Promise<number> {
    return await offlineDB.transactions
      .where('synced')
      .equals(false)
      .count();
  }

  /**
   * Supprime transactions synchronisées anciennes (> 7 jours)
   */
  static async cleanupOldSyncedTransactions(): Promise<number> {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const deleted = await offlineDB.transactions
      .where('synced')
      .equals(true)
      .and(txn => txn.synced_at! < sevenDaysAgo)
      .delete();

    console.log('🧹 Old synced transactions cleaned', {
      deleted_count: deleted
    });

    return deleted;
  }
}
```

---

**3. Service Worker (Background Sync)** :

```typescript
// public/sw.js (Service Worker)

// Installation
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(clients.claim());
});

// Background Sync
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered', event.tag);

  if (event.tag === 'sync-offline-transactions') {
    event.waitUntil(syncOfflineTransactions());
  }
});

// Fonction de synchronisation
async function syncOfflineTransactions() {
  try {
    console.log('🔄 Starting offline transactions sync...');

    // Import dynamique du service
    const { OfflineService } = await import('./services/offline-service.ts');

    // Synchronisation
    const result = await OfflineService.syncAllPending();

    console.log('✅ Sync complete', result);

    // Notification utilisateur si échecs
    if (result.failed > 0) {
      self.registration.showNotification('Assur\'Trans - Sync Partiellement Réussi', {
        body: `${result.synced} transactions synchronisées, ${result.failed} échouées`,
        icon: '/icon-192.png',
        badge: '/badge-72.png'
      });
    } else if (result.synced > 0) {
      self.registration.showNotification('Assur\'Trans - Sync Réussi', {
        body: `${result.synced} transactions synchronisées`,
        icon: '/icon-192.png',
        badge: '/badge-72.png'
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Sync error', error);
    throw error;
  }
}

// Détection retour online
self.addEventListener('online', () => {
  console.log('🌐 Connection restored');

  // Trigger background sync
  self.registration.sync.register('sync-offline-transactions')
    .then(() => {
      console.log('✅ Background sync registered');
    })
    .catch(err => {
      console.error('❌ Background sync registration failed', err);
    });
});
```

---

**4. Composant React (Usage)** :

```typescript
// src/pages/QRScannerPage.tsx (extrait)
import { OfflineService } from '@/services/offline-service';

export const QRScannerPage = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Écoute changements connexion
    const handleOnline = () => {
      setIsOffline(false);
      console.log('🌐 Connection restored');

      // Trigger sync
      if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
          registration.sync.register('sync-offline-transactions');
        });
      } else {
        // Fallback manuel
        OfflineService.syncAllPending();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      console.log('📴 Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Compte transactions en attente
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updatePendingCount = async () => {
    const count = await OfflineService.getPendingCount();
    setPendingCount(count);
  };

  const handleQRScan = async (qrData: string, validationCode: string) => {
    if (isOffline) {
      // Mode offline - Sauvegarde locale
      const txnId = await OfflineService.saveOfflineTransaction(
        qrData,
        validationCode,
        currentStation.id,
        currentPompiste.id
      );

      toast({
        title: '⚠️ Mode hors ligne',
        description: `Transaction enregistrée localement (${txnId}). Sera synchronisée automatiquement.`,
        variant: 'warning'
      });

      updatePendingCount();
    } else {
      // Mode online - Appel API direct
      // ... (code existant)
    }
  };

  return (
    <div>
      {/* Indicateur offline */}
      {isOffline && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Mode hors ligne</AlertTitle>
          <AlertDescription>
            Les transactions seront enregistrées localement et synchronisées automatiquement.
            {pendingCount > 0 && ` (${pendingCount} en attente)`}
          </AlertDescription>
        </Alert>
      )}

      {/* Scanner QR */}
      {/* ... */}

      {/* Bouton sync manuel */}
      {pendingCount > 0 && !isOffline && (
        <Button
          onClick={async () => {
            const result = await OfflineService.syncAllPending();
            toast({
              title: 'Synchronisation',
              description: `${result.synced} transactions synchronisées, ${result.failed} échouées`
            });
            updatePendingCount();
          }}
        >
          🔄 Synchroniser ({pendingCount})
        </Button>
      )}
    </div>
  );
};
```

---

## 💰 Réconciliation Financière

### Implémentation Complète

```typescript
// src/services/reconciliation-service.ts

interface ReconciliationRecord {
  date: string;
  source: 'assurtrans' | 'mobile_money' | 'ola_energy';
  transaction_id: string;
  amount: number;
  status: 'matched' | 'missing_in_source' | 'missing_in_target' | 'amount_mismatch';
  discrepancy_amount?: number;
  notes?: string;
}

interface ReconciliationReport {
  date: string;
  mobile_money: {
    records: ReconciliationRecord[];
    stats: {
      total: number;
      matched: number;
      mismatches: number;
      total_discrepancy: number;
    };
  };
  ola_energy: {
    records: ReconciliationRecord[];
    stats: {
      total: number;
      matched: number;
      mismatches: number;
      total_discrepancy: number;
    };
  };
  created_at: number;
}

export class ReconciliationService {
  /**
   * Réconciliation Mobile Money (recharges)
   */
  static async reconcileMobileMoneyTransactions(date: string): Promise<{
    records: ReconciliationRecord[];
    stats: any;
  }> {
    const [startOfDay, endOfDay] = this.getDayBounds(date);

    // 1. Transactions Assur'Trans
    const assurTransTxns = await db.payments.find({
      created_at: { $gte: startOfDay, $lt: endOfDay },
      status: 'success',
      source: { $in: ['orange', 'wave', 'free'] }
    }).toArray();

    // 2. Callbacks Mobile Money
    const mobileMoneyCallbacks = await db.mobile_money_callbacks.find({
      callback_at: { $gte: startOfDay, $lt: endOfDay },
      status: 'success'
    }).toArray();

    // 3. Comparaison
    const records: ReconciliationRecord[] = [];

    // Vérifier chaque transaction Assur'Trans
    for (const txn of assurTransTxns) {
      const callback = mobileMoneyCallbacks.find(
        cb => cb.transaction_id === txn.transaction_id
      );

      if (!callback) {
        // Transaction Assur'Trans sans callback Mobile Money
        records.push({
          date,
          source: 'assurtrans',
          transaction_id: txn.transaction_id,
          amount: txn.amount,
          status: 'missing_in_target',
          notes: 'Transaction Assur\'Trans sans callback Mobile Money (peut indiquer problème webhook)'
        });
      } else if (Math.abs(callback.amount - txn.amount) > 0.01) {
        // Montants différents
        records.push({
          date,
          source: 'assurtrans',
          transaction_id: txn.transaction_id,
          amount: txn.amount,
          status: 'amount_mismatch',
          discrepancy_amount: callback.amount - txn.amount,
          notes: `Écart: Assur'Trans=${txn.amount} FCFA, Mobile Money=${callback.amount} FCFA`
        });
      } else {
        // Match parfait
        records.push({
          date,
          source: 'assurtrans',
          transaction_id: txn.transaction_id,
          amount: txn.amount,
          status: 'matched'
        });
      }
    }

    // Vérifier callbacks orphelins (sans transaction Assur'Trans)
    for (const callback of mobileMoneyCallbacks) {
      const txn = assurTransTxns.find(
        t => t.transaction_id === callback.transaction_id
      );

      if (!txn) {
        records.push({
          date,
          source: 'mobile_money',
          transaction_id: callback.transaction_id,
          amount: callback.amount,
          status: 'missing_in_source',
          notes: 'Callback Mobile Money sans transaction Assur\'Trans (probable fraude ou double-callback)'
        });
      }
    }

    // 4. Statistiques
    const stats = {
      total: records.length,
      matched: records.filter(r => r.status === 'matched').length,
      mismatches: records.filter(r => r.status !== 'matched').length,
      total_discrepancy: records
        .filter(r => r.status === 'amount_mismatch')
        .reduce((sum, r) => sum + (r.discrepancy_amount || 0), 0)
    };

    console.log('📊 Mobile Money reconciliation complete', {
      date,
      ...stats
    });

    return { records, stats };
  }

  /**
   * Réconciliation OLA ENERGY (consommation)
   */
  static async reconcileOLAEnergyTransactions(date: string): Promise<{
    records: ReconciliationRecord[];
    stats: any;
  }> {
    const [startOfDay, endOfDay] = this.getDayBounds(date);

    // 1. Commandes Assur'Trans complétées
    const assurTransOrders = await db.orders.find({
      completed_at: { $gte: startOfDay, $lt: endOfDay },
      status: 'completed'
    }).toArray();

    // 2. Transactions OLA ENERGY (via API partenaire)
    const olaEnergyTxns = await this.fetchOLAEnergyTransactions(date);

    // 3. Comparaison
    const records: ReconciliationRecord[] = [];

    for (const order of assurTransOrders) {
      const olaTxn = olaEnergyTxns.find(
        txn => txn.reference_id === order.id
      );

      if (!olaTxn) {
        records.push({
          date,
          source: 'assurtrans',
          transaction_id: order.id,
          amount: order.consumed_amount,
          status: 'missing_in_target',
          notes: 'Commande Assur\'Trans sans transaction OLA ENERGY'
        });
      } else if (Math.abs(olaTxn.amount - order.consumed_amount) > 0.01) {
        records.push({
          date,
          source: 'assurtrans',
          transaction_id: order.id,
          amount: order.consumed_amount,
          status: 'amount_mismatch',
          discrepancy_amount: olaTxn.amount - order.consumed_amount,
          notes: `Écart: Assur'Trans=${order.consumed_amount} FCFA, OLA=${olaTxn.amount} FCFA`
        });
      } else {
        records.push({
          date,
          source: 'assurtrans',
          transaction_id: order.id,
          amount: order.consumed_amount,
          status: 'matched'
        });
      }
    }

    // Vérifier transactions OLA orphelines
    for (const olaTxn of olaEnergyTxns) {
      const order = assurTransOrders.find(
        o => o.id === olaTxn.reference_id
      );

      if (!order) {
        records.push({
          date,
          source: 'ola_energy',
          transaction_id: olaTxn.reference_id,
          amount: olaTxn.amount,
          status: 'missing_in_source',
          notes: 'Transaction OLA ENERGY sans commande Assur\'Trans'
        });
      }
    }

    // 4. Statistiques
    const stats = {
      total: records.length,
      matched: records.filter(r => r.status === 'matched').length,
      mismatches: records.filter(r => r.status !== 'matched').length,
      total_discrepancy: records
        .filter(r => r.status === 'amount_mismatch')
        .reduce((sum, r) => sum + (r.discrepancy_amount || 0), 0)
    };

    console.log('📊 OLA ENERGY reconciliation complete', {
      date,
      ...stats
    });

    return { records, stats };
  }

  /**
   * Génère rapport complet
   */
  static async generateDailyReport(date: string): Promise<ReconciliationReport> {
    console.log('📊 Generating reconciliation report', { date });

    // Parallélisation
    const [mobileMoneyResult, olaEnergyResult] = await Promise.all([
      this.reconcileMobileMoneyTransactions(date),
      this.reconcileOLAEnergyTransactions(date)
    ]);

    const report: ReconciliationReport = {
      date,
      mobile_money: mobileMoneyResult,
      ola_energy: olaEnergyResult,
      created_at: Date.now()
    };

    // Sauvegarde rapport
    await db.reconciliation_reports.insert(report);

    // Alertes si écarts critiques
    await this.checkAndAlertCriticalDiscrepancies(report);

    console.log('✅ Reconciliation report generated', {
      date,
      mobile_money_total: mobileMoneyResult.stats.total,
      ola_energy_total: olaEnergyResult.stats.total
    });

    return report;
  }

  /**
   * Vérifie et alerte écarts critiques
   */
  private static async checkAndAlertCriticalDiscrepancies(
    report: ReconciliationReport
  ): Promise<void> {
    const CRITICAL_THRESHOLD = 100000; // 100,000 FCFA

    const criticalMobileMoney = report.mobile_money.stats.total_discrepancy > CRITICAL_THRESHOLD;
    const criticalOLAEnergy = report.ola_energy.stats.total_discrepancy > CRITICAL_THRESHOLD;

    if (criticalMobileMoney || criticalOLAEnergy) {
      // Alerte email
      await emailService.send({
        to: ['admin@assurtrans.com', 'finance@assurtrans.com'],
        subject: `⚠️ Écarts de réconciliation critiques (${report.date})`,
        html: this.generateAlertEmailHTML(report)
      });

      // Alerte Slack/Teams (optionnel)
      await slackService.send({
        channel: '#alerts-finance',
        text: `⚠️ Écarts de réconciliation détectés pour ${report.date}`,
        blocks: this.generateSlackBlocks(report)
      });
    }
  }

  /**
   * Export CSV
   */
  static async exportToCSV(date: string): Promise<string> {
    const report = await db.reconciliation_reports.findOne({ date });

    if (!report) {
      throw new Error(`Report not found for date: ${date}`);
    }

    const rows = [];

    // Header
    rows.push('Date,Source,Transaction ID,Amount,Status,Discrepancy,Notes');

    // Mobile Money
    for (const record of report.mobile_money.records) {
      rows.push(this.recordToCSVRow(record));
    }

    // OLA ENERGY
    for (const record of report.ola_energy.records) {
      rows.push(this.recordToCSVRow(record));
    }

    return rows.join('\n');
  }

  // Helpers
  private static getDayBounds(date: string): [number, number] {
    const d = new Date(date);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(d.setHours(23, 59, 59, 999)).getTime();
    return [startOfDay, endOfDay];
  }

  private static async fetchOLAEnergyTransactions(date: string): Promise<any[]> {
    // Appel API OLA ENERGY
    // À implémenter selon leur documentation
    return [];
  }

  private static recordToCSVRow(record: ReconciliationRecord): string {
    return [
      record.date,
      record.source,
      record.transaction_id,
      record.amount,
      record.status,
      record.discrepancy_amount || '',
      `"${record.notes || ''}"`
    ].join(',');
  }

  private static generateAlertEmailHTML(report: ReconciliationReport): string {
    // Template HTML email
    return `...`;
  }

  private static generateSlackBlocks(report: ReconciliationReport): any[] {
    // Slack blocks
    return [];
  }
}

// Cron job quotidien (exécution 2h du matin)
cron.schedule('0 2 * * *', async () => {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  await ReconciliationService.generateDailyReport(yesterday);
});
```

---

## 🎯 Résumé & Checklist

### Sprint 2 (En Cours) ⏳
- [ ] API validation < 2s
- [ ] HMAC-SHA256 activation
- [ ] One-time use enforcement
- [ ] Expiration checking
- [ ] Redis caching
- [ ] Rate limiting

### Sprint 3 (À Venir) 📅
- [ ] OTP generation + validation
- [ ] SMS integration (Twilio)
- [ ] WhatsApp integration
- [ ] Multi-channel orchestration

### Sprint 4 (À Venir) 📅
- [ ] Mode offline TPE (IndexedDB)
- [ ] Background sync service
- [ ] GPS tracking
- [ ] Offline reconciliation

### Sprint 5 (À Venir) 📅
- [ ] Réconciliation automatique
- [ ] Dashboard admin
- [ ] OLA ENERGY TPE API
- [ ] ML fraud detection

---

**Document créé le** : 12/01/2025  
**Version** : 1.0  
**Statut** : 🛠️ **Guide d'Implémentation Pratique**
