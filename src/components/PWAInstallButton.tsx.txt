import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-xl border border-[#222222] bg-[#000000] text-[#FFFFFF] hover:border-[#444444] transition shadow-sm"
        title="Install KindleFlow for offline reading"
      >
        <Download className="w-3.5 h-3.5 text-[#FFFFFF]" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-xl border border-[#222222] bg-[#000000] text-[#888888] hover:text-[#FFFFFF] hover:border-[#444444] transition shadow-sm"
          title="Install on iPhone / iPad"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div 
            id="ios-install-modal" 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setShowIOSGuide(false)}
          >
            <div 
              className="w-full max-w-sm rounded-2xl bg-[#000000] border border-[#222222] p-6 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                id="btn-close-ios-guide"
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-[#888888] hover:text-[#FFFFFF] transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#000000] border border-[#222222] flex items-center justify-center text-[#FFFFFF]">
                  <Share className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#FFFFFF]">Install KindleFlow on iOS</h3>
              </div>

              <p className="text-xs text-[#888888] leading-relaxed mb-4">
                You can read all your saved books completely offline without internet or data:
              </p>

              <div className="space-y-2.5 text-xs text-[#CCCCCC] bg-[#0A0A0A] border border-[#1A1A1A] p-3 rounded-xl font-mono">
                <div className="flex items-start gap-2">
                  <span className="text-[#888888]">1.</span>
                  <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#888888]">2.</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#FFFFFF] py-2 text-xs font-semibold text-[#000000] hover:bg-[#E5E5E5] transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
