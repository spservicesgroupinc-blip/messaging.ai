import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Bell, BellOff, CheckCircle2, XCircle } from 'lucide-react';

const VAPID_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BGn2x9d4zK3m7pR1vL5qW8yT0oA4sD6fG7hJ8kL1mN2oP3qR4sT5uV6wX7yZ8aB9cD0eF1gH2iJ3kL4mN5oP6qR7sT8uV9wX0yZ1';

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
    if (!currentUserId) return;
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

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <BellOff className="h-4 w-4" />
        <span>Push notifications not supported in this browser</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        <XCircle className="h-4 w-4" />
        <span>Push notifications blocked. Enable in browser settings.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {subscribed ? (
        <Button variant="secondary" size="sm" onClick={unsubscribe} disabled={requesting}>
          <Bell className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Push On</span>
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={requestPermission} disabled={requesting}>
          {requesting ? null : <Bell className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">
            {requesting ? 'Subscribing...' : 'Push Off'}
          </span>
        </Button>
      )}
    </div>
  );
};
