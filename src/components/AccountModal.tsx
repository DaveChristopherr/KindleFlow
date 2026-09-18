import React from 'react';
import { X, BookOpen, CheckCircle, Clock, User } from 'lucide-react';
import { Book } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | null;
  books: Book[];
  onSignOut: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  books,
  onSignOut,
}) => {
  if (!isOpen) return null;

  // Calculate stats
  const totalBooks = books.length;
  const completedBooks = books.filter((b) => {
    const effectiveTotal = Math.max(
      b.totalPages || 1,
      b.lastPageRead || 1,
      Math.ceil((b.totalWords || 0) / 220)
    );
    const read = b.lastPageRead || 1;
    return effectiveTotal > 1 && read >= effectiveTotal;
  }).length;

  // Actual time spent reading (in seconds)
  const totalActualSeconds = books.reduce((acc, book) => acc + (book.timeSpent || 0), 0);

  // Total estimated hours for the library collection
  const totalLibraryEstWords = books.reduce((acc, b) => {
    return acc + (b.totalWords || Math.max(200, (b.totalPages || 1) * 220));
  }, 0);
  const totalEstMins = Math.round(totalLibraryEstWords / 220);
  const totalEstHours = (totalEstMins / 60).toFixed(1);

  const formatActualReadingTime = (seconds: number) => {
    if (seconds === 0) return '0m';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#000000] border border-[#222222] rounded-2xl p-6 shadow-2xl text-[#FFFFFF]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#FFFFFF]" />
            <h2 className="text-sm font-bold tracking-tight text-[#FFFFFF]">Account Dashboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#888888] hover:text-[#FFFFFF] hover:bg-[#111111] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Info */}
        <div className="mb-6 p-4 rounded-xl bg-[#000000] border border-[#222222]">
          <span className="text-[10px] font-mono text-[#888888] block mb-1 uppercase tracking-wider">
            Signed in as
          </span>
          <span className="text-xs font-mono text-[#FFFFFF] truncate block font-medium">
            {userEmail || 'Guest Reader'}
          </span>
        </div>

        {/* Reading Statistics - Black Cards with subtle border */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#222222] text-center">
            <BookOpen className="w-4 h-4 mx-auto mb-1.5 text-[#888888]" />
            <span className="text-base font-bold font-mono text-[#FFFFFF] block">{totalBooks}</span>
            <span className="text-[10px] text-[#888888] uppercase tracking-wider block">Books</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#222222] text-center">
            <CheckCircle className="w-4 h-4 mx-auto mb-1.5 text-[#888888]" />
            <span className="text-base font-bold font-mono text-[#FFFFFF] block">{completedBooks}</span>
            <span className="text-[10px] text-[#888888] uppercase tracking-wider block">Finished</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#222222] text-center">
            <Clock className="w-4 h-4 mx-auto mb-1.5 text-[#888888]" />
            <span className="text-base font-bold font-mono text-[#FFFFFF] block">
              {formatActualReadingTime(totalActualSeconds)}
            </span>
            <span className="text-[10px] text-[#888888] uppercase tracking-wider block">Time Read</span>
          </div>
        </div>

        {/* Estimated Total Library Reading Material */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#000000] border border-[#222222] text-[11px] font-mono text-[#888888] mb-6">
          <span>Estimated library content</span>
          <span className="text-[#FFFFFF] font-bold">~{totalEstHours} hours</span>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="w-full py-2.5 px-4 bg-[#000000] hover:bg-[#111111] border border-[#222222] hover:border-[#444444] text-[#FFFFFF] text-xs font-semibold rounded-xl transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
