import { table } from '@devvai/devv-code-backend';
import type { Notification, NotificationCreateInput } from '../types';

const NOTIFICATIONS_TABLE_ID = 'f4fa0h4yv2f5';

export const notificationService = {
  // Get user's notifications
  async getUserNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
    try {
      const result = await table.getItems(NOTIFICATIONS_TABLE_ID);
      const allNotifications = (result.items || []) as Notification[];
      
      let filtered = allNotifications.filter(n => n._uid === userId);
      
      if (unreadOnly) {
        filtered = filtered.filter(n => n.read === 'no');
      }
      
      // Sort by created_at descending (newest first)
      return filtered.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  },

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const unread = await this.getUserNotifications(userId, true);
      return unread.length;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  },

  // Create notification
  async createNotification(
    userId: string,
    input: NotificationCreateInput
  ): Promise<void> {
    try {
      await table.addItem(NOTIFICATIONS_TABLE_ID, {
        _uid: userId,
        ...input,
        read: 'no',
        metadata: input.metadata ? JSON.stringify(input.metadata) : '',
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await table.updateItem(NOTIFICATIONS_TABLE_ID, {
        _uid: userId,
        _id: notificationId,
        read: 'yes',
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  },

  // Mark all as read
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const unread = await this.getUserNotifications(userId, true);
      
      await Promise.all(
        unread.map(notification => 
          table.updateItem(NOTIFICATIONS_TABLE_ID, {
            _uid: notification._uid,
            _id: notification._id,
            read: 'yes'
          })
        )
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      throw error;
    }
  },

  // Delete notification
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      await table.deleteItem(NOTIFICATIONS_TABLE_ID, { _uid: userId, _id: notificationId });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error;
    }
  },

  // Delete all read notifications
  async deleteAllRead(userId: string): Promise<void> {
    try {
      const notifications = await this.getUserNotifications(userId);
      const read = notifications.filter(n => n.read === 'yes');
      
      await Promise.all(
        read.map(notification => 
          table.deleteItem(NOTIFICATIONS_TABLE_ID, { _uid: notification._uid, _id: notification._id })
        )
      );
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
      throw error;
    }
  },

  // Create system notifications for common events
  async notifyLowBalance(userId: string, balance: number): Promise<void> {
    await this.createNotification(userId, {
      title: 'Solde faible',
      message: `Votre solde est de ${balance.toFixed(2)} FCFA. Rechargez votre portefeuille.`,
      type: 'warning',
      category: 'fuel',
      priority: 'high',
      action_url: '/fuel-ordering',
    });
  },

  async notifyOrderCompleted(userId: string, orderId: string, amount: number): Promise<void> {
    await this.createNotification(userId, {
      title: 'Commande livrée',
      message: `Votre commande de ${amount.toFixed(2)} FCFA a été livrée avec succès.`,
      type: 'success',
      category: 'fuel',
      priority: 'medium',
      action_url: '/fuel-ordering',
      metadata: { orderId },
    });
  },

  async notifyInsuranceExpiring(userId: string, daysLeft: number, policyNumber: string): Promise<void> {
    await this.createNotification(userId, {
      title: 'Assurance expire bientôt',
      message: `Votre assurance expire dans ${daysLeft} jours. Renouvelez maintenant.`,
      type: 'alert',
      category: 'insurance',
      priority: 'high',
      action_url: '/insurance',
      metadata: { policyNumber },
    });
  },

  async notifyVehicleMaintenance(userId: string, vehicleId: string, vehicleName: string): Promise<void> {
    await this.createNotification(userId, {
      title: 'Entretien véhicule',
      message: `${vehicleName} nécessite un entretien. Planifiez une révision.`,
      type: 'warning',
      category: 'vehicle',
      priority: 'medium',
      action_url: '/fleet-management',
      metadata: { vehicleId },
    });
  },

  async notifyPointsEarned(userId: string, points: number, tier: string): Promise<void> {
    await this.createNotification(userId, {
      title: 'Points gagnés',
      message: `Vous avez gagné ${points} points! Niveau actuel: ${tier}`,
      type: 'success',
      category: 'loyalty',
      priority: 'low',
      action_url: '/loyalty',
    });
  },

  async notifyPaymentSuccess(userId: string, amount: number, provider: string): Promise<void> {
    await this.createNotification(userId, {
      title: 'Paiement réussi',
      message: `Paiement de ${amount.toFixed(2)} FCFA via ${provider} effectué avec succès.`,
      type: 'success',
      category: 'payment',
      priority: 'medium',
      action_url: '/payments',
    });
  },
};
