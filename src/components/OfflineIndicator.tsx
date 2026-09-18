import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../utils/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div 
      id="offline-indicator-banner"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#000000] border border-[#333333] px-3.5 py-2 text-xs font-mono font-medium text-[#E5E5E5] shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="relative flex items-center justify-center">
        <WifiOff className="w-3.5 h-3.5 text-[#888888]" />
      </div>
      <span>Offline Mode • Saved books available</span>
    </div>
  );
};
