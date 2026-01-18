import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  checkInterval?: number; // ms between connectivity checks (default: 10000)
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  checkInterval = 10000
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);

  // Check internet connectivity by pinging a reliable endpoint
  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      // Try to fetch a small resource from a reliable CDN
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      setIsOnline(true);
    } catch {
      // If fetch fails, fall back to navigator.onLine
      setIsOnline(navigator.onLine);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkConnection();

    // Periodic check
    const interval = setInterval(checkConnection, checkInterval);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection, checkInterval]);

  // Don't render anything when online
  if (isOnline) {
    return null;
  }

  return (
    <>
      {/* Overlay - blocks all interactions */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />

      {/* Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-sm">No Internet Connection</div>
              <div className="text-xs text-red-100">
                Please check your network settings
              </div>
            </div>
          </div>
          <button
            onClick={checkConnection}
            disabled={isChecking}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 disabled:bg-red-800 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Retry'}
          </button>
        </div>
      </div>

      {/* Center message */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 shadow-2xl text-center max-w-xs pointer-events-auto">
          <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">You're Offline</h3>
          <p className="text-sm text-slate-400">
            Connect to the internet to use your wallet.
          </p>
        </div>
      </div>
    </>
  );
};