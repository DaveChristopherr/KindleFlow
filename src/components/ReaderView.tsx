/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Book, 
  ReadingSettings, 
  ReflowPage, 
  ThemeMode, 
  FontMode
} from '../types';
import { calculateReflowPages } from '../utils/reflowEngine';
import { 
  ArrowLeft, 
  List, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  Sun,
  Palette,
  X,
  Clock,
  Check
} from 'lucide-react';

interface ReaderViewProps {
  book: Book;
  settings: ReadingSettings;
  onUpdateSettings: (settings: ReadingSettings) => void;
  onBackToLibrary: () => void;
  onUpdateProgress: (bookId: string, pageNumber: number, timeSpent?: number) => void;
  onToggleBookmark: (bookId: string, pageNumber: number) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  settings,
  onUpdateSettings,
  onBackToLibrary,
  onUpdateProgress,
}) => {
  const [pages, setPages] = useState<ReflowPage[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(book.lastPageRead || 1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showBrightnessPopover, setShowBrightnessPopover] = useState<boolean>(false);
  const [showThemePopover, setShowThemePopover] = useState<boolean>(false);
  const [showTocDrawer, setShowTocDrawer] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [turnDirection, setTurnDirection] = useState<'next' | 'prev' | 'none'>('none');
  const [sessionSeconds, setSessionSeconds] = useState<number>(book.timeSpent || 0);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastSavedPageRef = useRef<number>(book.lastPageRead || 1);
  const onUpdateProgressRef = useRef(onUpdateProgress);
  const turnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSecondsRef = useRef<number>(book.timeSpent || 0);

  useEffect(() => {
    onUpdateProgressRef.current = onUpdateProgress;
  }, [onUpdateProgress]);

  // Session reading timer (tracks active duration in current book)
  useEffect(() => {
    const initialTime = book.timeSpent || 0;
    setSessionSeconds(initialTime);
    sessionSecondsRef.current = initialTime;
    
    const interval = setInterval(() => {
      sessionSecondsRef.current += 1;
      setSessionSeconds(sessionSecondsRef.current);
      
      // Save periodically
      if (sessionSecondsRef.current % 10 === 0) {
        onUpdateProgressRef.current(book.id, lastSavedPageRef.current, sessionSecondsRef.current);
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      onUpdateProgressRef.current(book.id, lastSavedPageRef.current, sessionSecondsRef.current);
    };
  }, [book.id]);

  // Clean up animation and save timeouts on unmount
  useEffect(() => {
    return () => {
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Sync state if a different book is loaded
  useEffect(() => {
    const initialPage = book.lastPageRead || 1;
    setCurrentPage(initialPage);
    lastSavedPageRef.current = initialPage;
  }, [book.id]);

  // Dynamic Reflow Calculation based on container dimensions
  const recomputeReflow = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width === 0 || height === 0) return;

    const newPages = calculateReflowPages(book, width, height, settings);
    setPages(newPages);
    setCurrentPage((prev) => Math.min(Math.max(1, prev), Math.max(1, newPages.length)));
  }, [book, settings.fontSize, settings.font, settings.lineHeight, settings.marginWidth]);

  useEffect(() => {
    recomputeReflow();
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        recomputeReflow();
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [recomputeReflow]);

  // Notify parent only when currentPage genuinely changes from the saved state, with visual auto-save indicator
  useEffect(() => {
    if (lastSavedPageRef.current !== currentPage) {
      lastSavedPageRef.current = currentPage;
      onUpdateProgressRef.current(book.id, currentPage, sessionSecondsRef.current);

      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setIsSaving(false);
      }, 1500);
    }
  }, [book.id, currentPage]);

  const formatSessionTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${remMins}m read`;
    }
    if (mins > 0) {
      return `${mins}m ${secs < 10 ? '0' : ''}${secs}s read`;
    }
    return `${secs}s read`;
  };

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev < pages.length) {
        setTurnDirection('next');
        if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
        turnTimeoutRef.current = setTimeout(() => setTurnDirection('none'), 180);
        return prev + 1;
      }
      return prev;
    });
  }, [pages.length]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev > 1) {
        setTurnDirection('prev');
        if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
        turnTimeoutRef.current = setTimeout(() => setTurnDirection('none'), 180);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'Escape') {
        setShowControls((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPage, goToPrevPage]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const activePage = pages[currentPage - 1];
  const progressPercent = pages.length > 0 ? Math.round((currentPage / pages.length) * 100) : 0;

  // Reading time estimate (~200 words/min)
  const remainingPages = Math.max(0, pages.length - currentPage);
  const estMinutesRemaining = Math.max(1, Math.round(remainingPages * 0.75));

  // Theming ONLY for reader page content container
  const getPageContainerTheme = () => {
    switch (settings.theme) {
      case 'sepia':
        return {
          bg: '#F4ECD8',
          text: '#2D2A26',
          border: '#E3D7BF',
          muted: '#7B7163',
        };
      case 'light':
        return {
          bg: '#FFFFFF',
          text: '#111111',
          border: '#E5E5E5',
          muted: '#666666',
        };
      case 'oled':
      default:
        return {
          bg: '#000000',
          text: '#E5E5E5',
          border: '#222222',
          muted: '#888888',
        };
    }
  };

  const pageTheme = getPageContainerTheme();
  const brightnessVal = settings.brightness ?? 100;

  return (
    <div 
      id="reader-view-root" 
      className="relative w-full h-full overflow-hidden flex flex-col select-none bg-[#000000] text-[#FFFFFF]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header Overlay (Strict Monochrome) */}
      <header
        id="reader-topbar"
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-6 py-3 bg-[#000000]/95 backdrop-blur-md border-b border-[#222222] transition-all duration-200 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        {/* Left: Back & TOC */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="btn-back-library"
            onClick={onBackToLibrary}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] hover:border-[#444444] text-xs font-medium text-[#FFFFFF] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Library</span>
          </button>

          <button
            id="btn-toc"
            onClick={() => setShowTocDrawer(true)}
            className="p-1.5 sm:p-2 rounded-lg bg-[#111111] border border-[#222222] hover:border-[#444444] text-[#FFFFFF] transition"
            title="Table of Contents"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Title, Chapter & Session Timer */}
        <div className="text-center truncate px-1 max-w-[120px] xs:max-w-[150px] sm:max-w-xs md:max-w-sm">
          <h2 id="reader-book-title" className="text-xs font-bold text-[#FFFFFF] truncate leading-tight">
            {book.title}
          </h2>
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#888888] truncate mt-0.5">
            <span id="reader-chapter-title" className="truncate">{activePage?.chapterTitle || 'Reading'}</span>
            <span className="text-[#333333]">&bull;</span>
            <span id="top-session-timer" className="text-[#AAAAAA] whitespace-nowrap">{formatSessionTime(sessionSeconds)}</span>
          </div>
        </div>

        {/* Right: Controls (Font, Brightness, Themes, Fullscreen) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Font Size Adjusters */}
          <div className="flex items-center bg-[#111111] border border-[#222222] rounded-lg p-0.5">
            <button
              id="btn-font-dec"
              onClick={() => onUpdateSettings({ ...settings, fontSize: Math.max(12, settings.fontSize - 2) })}
              className="px-1.5 sm:px-2 py-1 text-[11px] font-mono font-bold text-[#888888] hover:text-[#FFFFFF] transition"
              title="Decrease font size"
            >
              A-
            </button>
            <span id="label-font-size" className="text-[10px] font-mono px-1 sm:px-1.5 text-[#FFFFFF]">
              {settings.fontSize}
            </span>
            <button
              id="btn-font-inc"
              onClick={() => onUpdateSettings({ ...settings, fontSize: Math.min(32, settings.fontSize + 2) })}
              className="px-1.5 sm:px-2 py-1 text-[11px] font-mono font-bold text-[#888888] hover:text-[#FFFFFF] transition"
              title="Increase font size"
            >
              A+
            </button>
          </div>

          {/* Brightness Toggle */}
          <button
            id="btn-brightness-toggle"
            onClick={() => {
              setShowBrightnessPopover((prev) => !prev);
              setShowThemePopover(false);
            }}
            className="p-1.5 sm:p-2 rounded-lg bg-[#111111] border border-[#222222] hover:border-[#444444] text-[#FFFFFF] transition"
            title="Adjust Brightness"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          {/* Theme Selector Toggle */}
          <button
            id="btn-theme-toggle"
            onClick={() => {
              setShowThemePopover((prev) => !prev);
              setShowBrightnessPopover(false);
            }}
            className="p-1.5 sm:p-2 rounded-lg bg-[#111111] border border-[#222222] hover:border-[#444444] text-[#FFFFFF] transition"
            title="Reader Themes"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen (Desktop/Tablet) */}
          <button
            id="btn-fullscreen"
            onClick={toggleFullscreen}
            className="hidden sm:block p-1.5 sm:p-2 rounded-lg bg-[#111111] border border-[#222222] hover:border-[#444444] text-[#888888] hover:text-[#FFFFFF] transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Brightness Popover Slider */}
      {showBrightnessPopover && (
        <div 
          id="panel-brightness"
          className="absolute top-14 right-14 z-40 bg-[#111111] border border-[#222222] rounded-xl p-3.5 shadow-2xl w-56 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-[#888888]">
            <span className="uppercase font-bold tracking-wider">Backlight</span>
            <span id="label-brightness-val" className="text-[#FFFFFF]">{brightnessVal}%</span>
          </div>
          <input
            type="range"
            id="brightness-slider"
            min="30"
            max="100"
            value={brightnessVal}
            onChange={(e) => onUpdateSettings({ ...settings, brightness: parseInt(e.target.value) })}
            className="w-full cursor-pointer"
          />
        </div>
      )}

      {/* Theme Popover (Applies ONLY to reading page container) */}
      {showThemePopover && (
        <div 
          id="panel-theme"
          className="absolute top-14 right-4 z-40 bg-[#111111] border border-[#222222] rounded-xl p-3 shadow-2xl w-48 flex flex-col gap-1.5"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] px-1 mb-1">
            Page Canvas
          </span>
          <button
            onClick={() => {
              onUpdateSettings({ ...settings, theme: 'oled' });
              setShowThemePopover(false);
            }}
            className={`text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition border ${
              settings.theme === 'oled' ? 'border-[#444444] bg-[#000000] text-[#FFFFFF]' : 'border-[#222222] bg-[#111111] text-[#888888] hover:text-[#FFFFFF]'
            }`}
          >
            <span>OLED Black</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#000000] border border-[#555555]"></span>
          </button>
          <button
            onClick={() => {
              onUpdateSettings({ ...settings, theme: 'sepia' });
              setShowThemePopover(false);
            }}
            className={`text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition border ${
              settings.theme === 'sepia' ? 'border-[#444444] bg-[#111111] text-[#FFFFFF]' : 'border-[#222222] bg-[#111111] text-[#888888] hover:text-[#FFFFFF]'
            }`}
          >
            <span>Sepia Paper</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#F4ECD8] border border-[#E3D7BF]"></span>
          </button>
          <button
            onClick={() => {
              onUpdateSettings({ ...settings, theme: 'light' });
              setShowThemePopover(false);
            }}
            className={`text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition border ${
              settings.theme === 'light' ? 'border-[#444444] bg-[#111111] text-[#FFFFFF]' : 'border-[#222222] bg-[#111111] text-[#888888] hover:text-[#FFFFFF]'
            }`}
          >
            <span>Crisp White</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF] border border-[#CCCCCC]"></span>
          </button>
        </div>
      )}

      {/* Reading Stage (Brightness Filter applied here) */}
      <main
        id="reader-brightness-layer"
        ref={containerRef}
        style={{
          filter: `brightness(${brightnessVal}%)`,
          transition: 'filter 0.15s ease-out',
        }}
        className="relative flex-1 w-full h-full flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-hidden"
      >
        {/* Navigation Tap Zones */}
        <div
          id="zone-prev"
          onClick={goToPrevPage}
          className="absolute top-0 bottom-0 left-0 w-1/4 z-10 cursor-w-resize"
          title="Previous Page"
        />
        <div
          id="zone-menu"
          onClick={() => {
            setShowControls((prev) => !prev);
            setShowBrightnessPopover(false);
            setShowThemePopover(false);
          }}
          className="absolute top-0 bottom-0 left-1/4 right-1/4 z-10 cursor-pointer"
          title="Toggle Controls"
        />
        <div
          id="zone-next"
          onClick={goToNextPage}
          className="absolute top-0 bottom-0 right-0 w-1/4 z-10 cursor-e-resize"
          title="Next Page"
        />

        {/* Rendered Page Surface Container */}
        <div
          id="page-container"
          style={{
            backgroundColor: pageTheme.bg,
            color: pageTheme.text,
            borderColor: pageTheme.border,
            transform: turnDirection === 'next' ? 'translateX(30px)' : turnDirection === 'prev' ? 'translateX(-30px)' : 'translateX(0)',
            opacity: turnDirection !== 'none' ? 0.7 : 1,
            transition: 'transform 0.18s ease-out, opacity 0.18s ease-out',
          }}
          className="w-full max-w-2xl h-full flex flex-col justify-between rounded-lg p-5 sm:p-8 border pointer-events-none z-0 shadow-lg"
        >
          {/* Paginated Content */}
          <div 
            id="page-content"
            style={{ fontSize: `${settings.fontSize}px`, lineHeight: 1.7 }}
            className="flex-1 overflow-hidden font-serif"
          >
            {activePage?.isChapterStart && (
              <h2 
                style={{ borderColor: pageTheme.border }}
                className="text-lg font-bold tracking-tight mb-4 pb-2 border-b"
              >
                {activePage.chapterTitle}
              </h2>
            )}
            {activePage ? (
              activePage.paragraphs.map((para, i) => (
                <p key={i} className="text-justify mb-4">
                  {para}
                </p>
              ))
            ) : (
              <p className="text-center py-20 opacity-60">Preparing reflowed pages...</p>
            )}
          </div>

          {/* Running Footer */}
          <div 
            style={{ borderColor: `${pageTheme.border}80`, color: pageTheme.muted }}
            className="flex items-center justify-between pt-3 text-[11px] font-mono border-t"
          >
            <span id="page-chapter-label" className="truncate max-w-[200px]">
              {activePage?.chapterTitle || 'KindleFlow'}
            </span>
            <span id="page-number-label">
              Page {currentPage} of {Math.max(1, pages.length)}
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Control Bar (Strict Monochrome) */}
      <footer
        id="reader-bottombar"
        className={`absolute bottom-0 left-0 right-0 z-30 px-4 sm:px-8 py-3.5 bg-[#000000]/95 backdrop-blur-md border-t border-[#222222] flex flex-col gap-2 transition-all duration-200 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto w-full">
          <button
            id="btn-prev-page"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg bg-[#111111] text-[#FFFFFF] border border-[#222222] hover:border-[#444444] disabled:opacity-30 disabled:pointer-events-none transition"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="range"
            id="page-slider"
            min={1}
            max={Math.max(1, pages.length)}
            value={currentPage}
            onChange={(e) => setCurrentPage(parseInt(e.target.value))}
            className="flex-1 cursor-pointer"
          />

          <button
            id="btn-next-page"
            onClick={goToNextPage}
            disabled={currentPage >= pages.length}
            className="p-1.5 rounded-lg bg-[#111111] text-[#FFFFFF] border border-[#222222] hover:border-[#444444] disabled:opacity-30 disabled:pointer-events-none transition"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-[#888888] max-w-2xl mx-auto w-full px-1">
          <div className="flex items-center gap-2">
            <span id="reading-percentage">{progressPercent}% completed</span>
            <span className="text-[#333333] hidden xs:inline">|</span>
            <span id="session-timer" className="flex items-center gap-1 text-[#CCCCCC]" title="Current reading session duration">
              <Clock className="w-3 h-3 text-[#888888]" />
              {formatSessionTime(sessionSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span 
              id="save-indicator-bar"
              className={`flex items-center gap-1 text-[10px] transition-all duration-300 ${
                isSaving ? 'opacity-100 text-[#FFFFFF]' : 'opacity-0 text-[#444444]'
              }`}
            >
              <Check className="w-3 h-3" />
              Saved
            </span>
            <span id="reading-stats">{estMinutesRemaining} min left in book</span>
          </div>
        </div>
      </footer>

      {/* Subtle Auto-Save Floating Indicator */}
      <div 
        id="save-indicator-toast"
        className={`absolute bottom-6 right-6 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111111]/95 border border-[#222222] text-[10px] font-mono text-[#CCCCCC] backdrop-blur-sm pointer-events-none transition-all duration-300 shadow-md ${
          isSaving ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1.5 scale-95 pointer-events-none'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF]"></span>
        <span>Progress saved</span>
      </div>

      {/* Table of Contents Drawer */}
      {showTocDrawer && (
        <div 
          id="drawer-toc"
          className="absolute inset-y-0 left-0 z-40 w-72 sm:w-80 bg-[#111111] border-r border-[#222222] shadow-2xl p-4 flex flex-col"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#222222] mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFFFFF]">Table of Contents</h3>
            <button
              id="btn-close-toc"
              onClick={() => setShowTocDrawer(false)}
              className="p-1 text-[#888888] hover:text-[#FFFFFF]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div id="toc-list" className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
            {book.chapters?.map((ch, idx) => (
              <button
                key={ch.id || idx}
                onClick={() => {
                  const target = pages.findIndex((p) => p.chapterIndex === idx);
                  if (target !== -1) {
                    setCurrentPage(target + 1);
                  }
                  setShowTocDrawer(false);
                }}
                className="text-left px-3 py-2 rounded-lg text-xs font-mono hover:bg-[#222222] text-[#888888] hover:text-[#FFFFFF] transition truncate"
              >
                {ch.title}
              </button>
            ))}
          </div>
          <div className="pt-3 mt-auto border-t border-[#1a1a1a] text-center text-[10px] text-[#666666]">
            <a
              href="https://davechristopher.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#666666] hover:text-[#888888] no-underline font-normal transition-colors"
            >
              @ davechristopher
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
