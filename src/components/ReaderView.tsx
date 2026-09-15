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
  Check,
  Search,
  ArrowRight
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
  const [tocSearch, setTocSearch] = useState<string>('');
  const [jumpPageInput, setJumpPageInput] = useState<string>('');
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

  // Session reading timer (tracks actual reading duration)
  useEffect(() => {
    const initialTime = book.timeSpent || 0;
    setSessionSeconds(initialTime);
    sessionSecondsRef.current = initialTime;
    
    const interval = setInterval(() => {
      sessionSecondsRef.current += 1;
      setSessionSeconds(sessionSecondsRef.current);
      
      // Save every 10 seconds
      if (sessionSecondsRef.current % 10 === 0) {
        onUpdateProgressRef.current(book.id, lastSavedPageRef.current, sessionSecondsRef.current);
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      onUpdateProgressRef.current(book.id, lastSavedPageRef.current, sessionSecondsRef.current);
    };
  }, [book.id]);

  // Clean up timeouts on unmount
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

  // Notify parent when currentPage changes
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
      return `${hrs}h ${remMins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }
    return `${secs}s`;
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'Escape') {
        setShowControls((prev) => !prev);
        setShowBrightnessPopover(false);
        setShowThemePopover(false);
        setShowTocDrawer(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPage, goToPrevPage]);

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput.trim(), 10);
    if (!isNaN(target) && target >= 1 && target <= pages.length) {
      setCurrentPage(target);
      setShowTocDrawer(false);
      setJumpPageInput('');
    }
  };

  const activePage = pages[currentPage - 1];
  const progressPercent = pages.length > 0 
    ? Math.min(100, Math.max(1, Math.round((currentPage / pages.length) * 100)))
    : 0;

  const totalBookWords = book.totalWords || Math.max(100, pages.length * 220);
  const remainingWords = Math.round(totalBookWords * (1 - (currentPage / Math.max(1, pages.length))));
  const estMinutesRemaining = Math.max(1, Math.round(remainingWords / 200));

  const getPageContainerTheme = () => {
    switch (settings.theme) {
      case 'sepia':
        return {
          bg: '#FBF0D9',
          text: '#2D271E',
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

  // Filtered chapters for TOC
  const filteredChapters = (book.chapters || []).map((ch, idx) => {
    const targetIndex = pages.findIndex((p) => p.chapterIndex === idx);
    const startPage = targetIndex !== -1 
      ? targetIndex + 1 
      : Math.max(1, Math.round((idx / Math.max(1, book.chapters.length)) * Math.max(1, pages.length)));
    return {
      ...ch,
      originalIndex: idx,
      startPage,
    };
  }).filter((ch) => 
    ch.title.toLowerCase().includes(tocSearch.toLowerCase()) ||
    ch.startPage.toString().includes(tocSearch)
  );

  return (
    <div 
      id="reader-view-root" 
      className="relative w-full h-full overflow-hidden flex flex-col select-none bg-[#000000] text-[#FFFFFF]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header Overlay */}
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
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-[#000000] border border-[#222222] hover:border-[#444444] text-xs font-medium text-[#FFFFFF] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Library</span>
          </button>

          <button
            id="btn-toc"
            onClick={() => setShowTocDrawer(true)}
            className="p-1.5 sm:p-2 rounded-xl bg-[#000000] border border-[#222222] hover:border-[#444444] text-[#FFFFFF] transition"
            title="Table of Contents"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Title & Reading Time */}
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

        {/* Right: Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Font Size */}
          <div className="flex items-center bg-[#000000] border border-[#222222] rounded-xl p-0.5">
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

          {/* Brightness */}
          <button
            id="btn-brightness-toggle"
            onClick={() => {
              setShowBrightnessPopover((prev) => !prev);
              setShowThemePopover(false);
            }}
            className={`p-1.5 sm:p-2 rounded-xl border transition ${
              showBrightnessPopover 
                ? 'bg-[#FFFFFF] text-[#000000] border-[#FFFFFF]' 
                : 'bg-[#000000] text-[#FFFFFF] border-[#222222] hover:border-[#444444]'
            }`}
            title="Brightness settings"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          {/* Theme */}
          <button
            id="btn-theme-toggle"
            onClick={() => {
              setShowThemePopover((prev) => !prev);
              setShowBrightnessPopover(false);
            }}
            className={`p-1.5 sm:p-2 rounded-xl border transition ${
              showThemePopover 
                ? 'bg-[#FFFFFF] text-[#000000] border-[#FFFFFF]' 
                : 'bg-[#000000] text-[#FFFFFF] border-[#222222] hover:border-[#444444]'
            }`}
            title="Theme & typography"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen */}
          <button
            id="btn-fullscreen-toggle"
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-xl bg-[#000000] border border-[#222222] hover:border-[#444444] text-[#FFFFFF] transition hidden xs:flex"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Brightness Popover */}
      {showBrightnessPopover && (
        <div 
          id="popover-brightness"
          className="absolute top-14 right-4 z-40 w-64 bg-[#000000] border border-[#222222] rounded-2xl p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#888888]">Brightness</span>
            <span className="text-xs font-mono text-[#FFFFFF]">{brightnessVal}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={100}
            value={brightnessVal}
            onChange={(e) => onUpdateSettings({ ...settings, brightness: parseInt(e.target.value) })}
            className="w-full cursor-pointer accent-[#FFFFFF]"
          />
        </div>
      )}

      {/* Theme & Typography Popover */}
      {showThemePopover && (
        <div 
          id="popover-theme"
          className="absolute top-14 right-4 z-40 w-72 bg-[#000000] border border-[#222222] rounded-2xl p-4 shadow-2xl space-y-4"
        >
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] block mb-2">Reading Palette</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onUpdateSettings({ ...settings, theme: 'oled' })}
                className={`py-1.5 px-2 text-xs rounded-xl font-medium border text-center transition ${
                  settings.theme === 'oled' 
                    ? 'border-[#FFFFFF] bg-[#000000] text-[#FFFFFF]' 
                    : 'border-[#222222] bg-[#000000] text-[#888888] hover:border-[#444444]'
                }`}
              >
                OLED
              </button>
              <button
                onClick={() => onUpdateSettings({ ...settings, theme: 'sepia' })}
                className={`py-1.5 px-2 text-xs rounded-xl font-medium border text-center transition ${
                  settings.theme === 'sepia' 
                    ? 'border-[#D4AF37] bg-[#FBF0D9] text-[#2D271E]' 
                    : 'border-[#222222] bg-[#000000] text-[#888888] hover:border-[#444444]'
                }`}
              >
                Sepia
              </button>
              <button
                onClick={() => onUpdateSettings({ ...settings, theme: 'light' })}
                className={`py-1.5 px-2 text-xs rounded-xl font-medium border text-center transition ${
                  settings.theme === 'light' 
                    ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#000000]' 
                    : 'border-[#222222] bg-[#000000] text-[#888888] hover:border-[#444444]'
                }`}
              >
                Light
              </button>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] block mb-2">Typography</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateSettings({ ...settings, font: 'serif' })}
                className={`py-1.5 px-2 text-xs rounded-xl border text-center font-serif transition ${
                  settings.font === 'serif' 
                    ? 'border-[#FFFFFF] bg-[#000000] text-[#FFFFFF]' 
                    : 'border-[#222222] bg-[#000000] text-[#888888] hover:border-[#444444]'
                }`}
              >
                Charis Serif
              </button>
              <button
                onClick={() => onUpdateSettings({ ...settings, font: 'newsreader' })}
                className={`py-1.5 px-2 text-xs rounded-xl border text-center font-serif italic transition ${
                  settings.font === 'newsreader' 
                    ? 'border-[#FFFFFF] bg-[#000000] text-[#FFFFFF]' 
                    : 'border-[#222222] bg-[#000000] text-[#888888] hover:border-[#444444]'
                }`}
              >
                Newsreader
              </button>
              <button
                onClick={() => onUpdateSettings({ ...settings, font: 'sans' })}
                className={`py-1.5 px-2 text-xs rounded-xl border text-center font-sans transition ${
                  settings.font === 'sans' 
                    ? 'border-[#FFFFFF] bg-[#000000] text-[#FFFFFF]' 
                    : 'border-[#222222] bg-[#000000] text-[#888888] hover:border-[#444444]'
                }`}
              >
                Modern Sans
              </button>
              <button
                onClick={() => onUpdateSettings({ ...settings, font: 'mono' })}
                className={`py-1.5 px-2 text-xs rounded-xl border text-center font-mono transition ${
                  settings.font === 'mono' 
                    ? 'border-[#FFFFFF] bg-[#000000] text-[#FFFFFF]' 
                    : 'border-[#222222] bg-[#000000] text-[#888888] hover:border-[#444444]'
                }`}
              >
                Monospace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Reading Stage */}
      <main
        id="reader-stage"
        ref={containerRef}
        onClick={(e) => {
          // If clicked in center 40% of screen, toggle controls
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            if (clickX < width * 0.25) {
              goToPrevPage();
            } else if (clickX > width * 0.75) {
              goToNextPage();
            } else {
              setShowControls((prev) => !prev);
              setShowBrightnessPopover(false);
              setShowThemePopover(false);
            }
          }
        }}
        style={{
          backgroundColor: pageTheme.bg,
          filter: brightnessVal < 100 ? `brightness(${brightnessVal / 100})` : undefined,
        }}
        className="flex-1 w-full h-full flex flex-col justify-between items-center px-4 sm:px-8 py-16 sm:py-20 transition-colors duration-200 cursor-pointer overflow-hidden"
      >
        <div 
          className={`w-full max-w-2xl h-full flex flex-col justify-between transition-all duration-150 ${
            turnDirection === 'next' 
              ? 'opacity-80 translate-x-1' 
              : turnDirection === 'prev' 
              ? 'opacity-80 -translate-x-1' 
              : 'opacity-100 translate-x-0'
          }`}
          style={{ color: pageTheme.text }}
        >
          {/* Running Header */}
          <div 
            style={{ borderColor: `${pageTheme.border}80`, color: pageTheme.muted }}
            className="flex items-center justify-between pb-2 text-[11px] font-mono border-b"
          >
            <span className="truncate max-w-[200px]">{book.title}</span>
            <span className="truncate max-w-[160px] text-right font-medium">
              {book.author || 'KindleFlow'}
            </span>
          </div>

          {/* Page Body Text */}
          <div 
            className="flex-1 my-auto flex flex-col justify-start overflow-hidden pt-4 leading-relaxed"
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight || 1.7,
              fontFamily: 
                settings.font === 'serif' ? "'Charis SIL', Georgia, serif" :
                settings.font === 'newsreader' ? "'Newsreader', Georgia, serif" :
                settings.font === 'sans' ? "'Plus Jakarta Sans', system-ui, sans-serif" :
                "'JetBrains Mono', monospace",
            }}
          >
            {activePage ? (
              activePage.paragraphs.map((para, i) => (
                <p key={i} className="text-justify mb-4 break-words">
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

      {/* Bottom Control Bar */}
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
            className="p-1.5 rounded-xl bg-[#000000] text-[#FFFFFF] border border-[#222222] hover:border-[#444444] disabled:opacity-30 disabled:pointer-events-none transition"
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
            className="flex-1 cursor-pointer accent-[#FFFFFF]"
          />

          <button
            id="btn-next-page"
            onClick={goToNextPage}
            disabled={currentPage >= pages.length}
            className="p-1.5 rounded-xl bg-[#000000] text-[#FFFFFF] border border-[#222222] hover:border-[#444444] disabled:opacity-30 disabled:pointer-events-none transition"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-[#888888] max-w-2xl mx-auto w-full px-1">
          <div className="flex items-center gap-2">
            <span id="reading-percentage">{progressPercent}% completed</span>
            <span className="text-[#333333] hidden xs:inline">|</span>
            <span id="session-timer" className="flex items-center gap-1 text-[#CCCCCC]" title="Actual reading duration">
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

      {/* Auto-Save Floating Indicator */}
      <div 
        id="save-indicator-toast"
        className={`absolute bottom-6 right-6 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#000000]/95 border border-[#222222] text-[10px] font-mono text-[#CCCCCC] backdrop-blur-sm pointer-events-none transition-all duration-300 shadow-md ${
          isSaving ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1.5 scale-95 pointer-events-none'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF]"></span>
        <span>Progress saved</span>
      </div>

      {/* Table of Contents Drawer with Backdrop & Jump-to-Page for long books */}
      {showTocDrawer && (
        <div 
          className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-xs"
          onClick={() => setShowTocDrawer(false)}
        >
          <div 
            id="drawer-toc"
            onClick={(e) => e.stopPropagation()}
            className="w-80 sm:w-96 max-w-[85vw] h-full bg-[#000000] border-r border-[#222222] shadow-2xl p-4 sm:p-5 flex flex-col text-[#FFFFFF]"
          >
            {/* TOC Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#222222] mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFFFFF]">Table of Contents</h3>
                <span className="text-[10px] font-mono text-[#888888]">{pages.length} total pages</span>
              </div>
              <button
                id="btn-close-toc"
                onClick={() => setShowTocDrawer(false)}
                className="p-1.5 rounded-lg text-[#888888] hover:text-[#FFFFFF] hover:bg-[#111111] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Jump to Page Input */}
            <form onSubmit={handleJumpToPage} className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={1}
                max={Math.max(1, pages.length)}
                placeholder={`Jump to page (1-${pages.length})...`}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-[#000000] border border-[#222222] rounded-xl text-[#FFFFFF] placeholder-[#666666] focus:outline-none focus:border-[#444444] font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#FFFFFF] text-[#000000] rounded-xl text-xs font-semibold hover:bg-[#E5E5E5] transition flex items-center gap-1"
              >
                <span>Go</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </form>

            {/* Filter Chapters */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
              <input
                type="text"
                placeholder="Search chapters or sections..."
                value={tocSearch}
                onChange={(e) => setTocSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#000000] border border-[#222222] rounded-xl text-[#FFFFFF] placeholder-[#666666] focus:outline-none focus:border-[#444444] font-mono"
              />
            </div>

            {/* Chapter List */}
            <div id="toc-list" className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
              {filteredChapters.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#888888]">
                  No matching chapters found.
                </div>
              ) : (
                filteredChapters.map((ch) => {
                  const isCurrentChapter = activePage?.chapterIndex === ch.originalIndex;
                  return (
                    <button
                      key={ch.id || ch.originalIndex}
                      onClick={() => {
                        setCurrentPage(ch.startPage);
                        setShowTocDrawer(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-xl text-xs font-mono transition group border ${
                        isCurrentChapter
                          ? 'bg-[#111111] border-[#333333] text-[#FFFFFF]'
                          : 'bg-[#000000] border-transparent hover:border-[#222222] hover:bg-[#0a0a0a] text-[#888888] hover:text-[#FFFFFF]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] text-[#555555] font-mono shrink-0">
                          {(ch.originalIndex + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="truncate flex-1 font-sans text-xs">
                          {ch.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-[#888888] bg-[#000000] px-1.5 py-0.5 rounded border border-[#222222] whitespace-nowrap">
                        p. {ch.startPage}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 mt-auto border-t border-[#1a1a1a] text-center text-[10px] text-[#666666]">
              <a
                href="https://github.com/DaveChristopherr/KindleFlow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#666666] hover:text-[#888888] no-underline font-normal transition-colors"
              >
                Created by Dave Christopher
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
