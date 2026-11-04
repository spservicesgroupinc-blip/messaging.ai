import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Bell, BellOff } from 'lucide-react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushNotificationBadgeProps {
  currentUserId?: string | null;
}

export const PushNotificationBadge: React.FC<PushNotificationBadgeProps> = ({
  currentUserId,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  );
  const [subscribed, setSubscribed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('relay_push_subscribed');
    setSubscribed(stored === 'true');

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager
          .getSubscription()
          .then((subscription) => {
            setSubscribed(!!subscription);
          })
          .catch(() => setSubscribed(false));
      });
    }
  }, []);

  const requestPermission = async () => {
    if (!currentUserId || !VAPID_PUBLIC_KEY) return;
    setRequesting(true);
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const permission = await Notification.requestPermission();
        setPermission(permission);

        if (permission === 'granted') {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
          });

          localStorage.setItem(
            'relay_push_subscription',
            JSON.stringify(subscription.toJSON())
          );
          localStorage.setItem('relay_push_subscribed', 'true');
          setSubscribed(true);

          if (currentUserId) {
            try {
              await fetch('/api/push-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: currentUserId,
                  subscription: subscription.toJSON(),
                }),
              });
            } catch {
              // Backend may not implement this yet; subscription is still stored locally
            }
          }
        }
      }
    } catch {
      setPermission('denied');
    } finally {
      setRequesting(false);
    }
  };

  const unsubscribe = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }
    } catch {
      // ignore
    }
    localStorage.removeItem('relay_push_subscription');
    localStorage.removeItem('relay_push_subscribed');
    setSubscribed(false);
  };

  const isSupported =
    typeof Notification !== 'undefined' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  if (!VAPID_PUBLIC_KEY && !subscribed) {
    return <span role="img" className="inline-flex h-8 w-8 items-center justify-center text-current opacity-50" title="Push notifications have not been configured for this workspace" aria-label="Push notifications have not been configured for this workspace"><BellOff className="h-4 w-4" /></span>;
  }

  if (!isSupported) {
    return (
      <span role="img" className="inline-flex h-8 w-8 items-center justify-center text-current opacity-50" title="Push notifications are not supported in this browser" aria-label="Push notifications are not supported in this browser"><BellOff className="h-4 w-4" /></span>
    );
  }

  if (permission === 'denied') {
    return (
      <span role="img" className="inline-flex h-8 w-8 items-center justify-center text-current opacity-50" title="Notifications are blocked. Enable them in browser settings." aria-label="Notifications are blocked. Enable them in browser settings."><BellOff className="h-4 w-4" /></span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {subscribed ? (
        <Button variant="ghost" size="sm" className="!h-8 !w-8 !p-0 !text-inherit hover:!bg-white/10" aria-label="Turn off push notifications" title="Turn off push notifications" onClick={unsubscribe} disabled={requesting}>
          <Bell className="h-3.5 w-3.5" />
          
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className="!h-8 !w-8 !p-0 !text-inherit hover:!bg-white/10" aria-label="Enable push notifications" title="Enable push notifications" onClick={requestPermission} disabled={requesting} loading={requesting}>
          {requesting ? null : <Bell className="h-3.5 w-3.5" />}

        </Button>
      )}
    </div>
  );
};
