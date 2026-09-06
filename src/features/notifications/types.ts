export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'alert';
export type NotificationCategory = 'fuel' | 'insurance' | 'vehicle' | 'payment' | 'loyalty' | 'system';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  _id: string;
  _uid: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: 'yes' | 'no';
  action_url?: string;
  metadata?: string;
  created_at: string;
}

export interface NotificationCreateInput {
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  action_url?: string;
  metadata?: Record<string, any>;
}
