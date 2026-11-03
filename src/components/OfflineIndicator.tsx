import React, { useEffect, useState } from 'react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div role="status" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-1.5 border-b border-amber-200 bg-amber-50 text-amber-900 text-xs font-medium">
      <div className="h-2 w-2 rounded-full bg-amber-600" />
      <span>You are offline — some features may be limited</span>
    </div>
  );
};
