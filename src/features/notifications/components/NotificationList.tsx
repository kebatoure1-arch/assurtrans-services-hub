import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { notificationService } from '../services/notification-service';
import type { Notification, NotificationType } from '../types';
import { cn } from '@/lib/utils';

interface NotificationListProps {
  userId: string;
  onNotificationRead?: () => void;
  onClose?: () => void;
}

const typeIcons: Record<NotificationType, any> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  alert: AlertCircle,
};

const typeColors: Record<NotificationType, string> = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  alert: 'text-orange-500',
};

export function NotificationList({ userId, onNotificationRead, onClose }: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  const loadNotifications = async () => {
    setLoading(true);
    const items = await notificationService.getUserNotifications(userId);
    setNotifications(items);
    setLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.read === 'no') {
      await notificationService.markAsRead(notification._id, userId);
      onNotificationRead?.();
      await loadNotifications();
    }

    if (notification.action_url) {
      navigate(notification.action_url);
      onClose?.();
    }
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead(userId);
    onNotificationRead?.();
    await loadNotifications();
  };

  const handleDeleteRead = async () => {
    await notificationService.deleteAllRead(userId);
    await loadNotifications();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    
    if (diffInMins < 1) return 'À l\'instant';
    if (diffInMins < 60) return `Il y a ${diffInMins} min`;
    
    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24) return `Il y a ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Il y a ${diffInDays}j`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="animate-pulse">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </h3>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-8 px-2 text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Tout lire
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteRead}
                className="h-8 px-2 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Nettoyer
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Aucune notification</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {notifications.map((notification, index) => {
              const Icon = typeIcons[notification.type];
              const iconColor = typeColors[notification.type];
              
              return (
                <div key={notification._id}>
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg transition-colors hover:bg-accent',
                      notification.read === 'no' && 'bg-primary/5'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn('mt-1', iconColor)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={cn(
                            'text-sm font-medium',
                            notification.read === 'no' && 'font-semibold'
                          )}>
                            {notification.title}
                          </h4>
                          {notification.read === 'no' && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                          {notification.message}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                  {index < notifications.length - 1 && <Separator className="my-1" />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
