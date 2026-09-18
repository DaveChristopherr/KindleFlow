import React, { useState, useRef } from 'react';
import { Book } from '../types';
import { parsePdfFile } from '../utils/pdfParser';
import { saveBook } from '../utils/db';
import { AuthModal } from './AuthModal';
import { AccountModal } from './AccountModal';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Upload, 
  Trash2, 
  Search, 
  FileText, 
  Clock, 
  Loader2,
  Bookmark,
  User,
  LogIn,
  BookOpen
} from 'lucide-react';

interface LibraryViewProps {
  books: Book[];
  userEmail: string | null;
  onSelectBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onBookAdded: (book: Book) => void;
  onSignOut: () => void;
  onSignInSuccess: (email: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  userEmail,
  onSelectBook,
  onDeleteBook,
  onBookAdded,
  onSignOut,
  onSignInSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredBooks = books.filter((b) => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFile = async (file: File) => {
    if (!userEmail) {
      setIsAuthModalOpen(true);
      setErrorMsg('Please sign in or create an account to save books to your private library.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Please select a valid PDF file.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    setProcessingStatus(`Reflowing "${file.name}"...`);

    try {
      const parsedBook = await parsePdfFile(file, (status) => {
        setProcessingStatus(status);
      });

      const bookWithUser: Book = {
        ...parsedBook,
        userId: userEmail,
      };

      await saveBook(bookWithUser, userEmail);
      onBookAdded(bookWithUser);
      setIsProcessing(false);
      onSelectBook(bookWithUser);
    } catch (err: unknown) {
      console.error('PDF extraction failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown parsing error';
      setErrorMsg(`Failed to parse PDF: ${message}`);
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!userEmail) {
      setIsAuthModalOpen(true);
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div id="library-container" className="flex-1 w-full max-w-5xl mx-auto px-3.5 sm:px-6 md:px-8 py-4 sm:py-8 overflow-y-auto bg-[#000000] text-[#FFFFFF] flex flex-col justify-between min-h-full">
      <div className="flex-1">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 mb-6 sm:mb-8 border-b border-[#222222]">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#FFFFFF]">
              KindleFlow
            </h1>
            <p className="text-xs text-[#888888]">Reflowable e-reader for PDFs</p>
          </div>

          {/* Search, Install & Account Controls */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <PWAInstallButton />

            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#000000] border border-[#222222] rounded-xl text-[#FFFFFF] placeholder-[#888888] focus:outline-none focus:border-[#444444] transition font-mono"
              />
            </div>

            {userEmail ? (
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="flex items-center gap-2 bg-[#000000] border border-[#222222] hover:border-[#444444] px-3 py-1.5 rounded-xl text-xs transition"
              >
                <User className="w-3.5 h-3.5 text-[#888888]" />
                <span className="max-w-[120px] truncate font-mono text-[#CCCCCC]">{userEmail}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#000000] hover:bg-[#111111] text-[#FFFFFF] border border-[#222222] hover:border-[#444444] rounded-xl transition whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Account</span>
              </button>
            )}
          </div>
        </header>

        {/* Upload Dropzone */}
        <section
          id="library-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!userEmail) {
              setIsAuthModalOpen(true);
            } else {
              fileInputRef.current?.click();
            }
          }}
          className={`border border-dashed rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center ${
            isDragging
              ? 'border-[#666666] bg-[#050505]'
              : 'border-[#222222] hover:border-[#444444] bg-[#000000] hover:bg-[#050505]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          {isProcessing ? (
            <div className="flex flex-col items-center py-4">
              <Loader2 className="w-8 h-8 text-[#FFFFFF] animate-spin mb-3" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FFFFFF] mb-1">Reflowing Document</h3>
              <p className="text-xs text-[#888888] font-mono">{processingStatus}</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-[#000000] border border-[#222222] text-[#FFFFFF] flex items-center justify-center mb-3">
                <Upload className="w-5 h-5" />
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#FFFFFF] mb-1">
                Upload PDF Document
              </h2>
              <p className="text-xs text-[#888888] max-w-sm mb-3">
                {userEmail 
                  ? 'Drop file here or click to browse. Content is parsed and reflowed for responsive reading.'
                  : 'Sign in to upload PDFs and synchronize your reading progress across sessions.'}
              </p>
              <span className="text-[11px] font-mono text-[#555555] uppercase tracking-widest">
                PDF up to 50MB
              </span>
            </>
          )}

          {errorMsg && (
            <div className="mt-4 flex items-center gap-2 text-xs text-[#FFFFFF] bg-[#000000] border border-[#444444] px-4 py-2 rounded-xl">
              <span>{errorMsg}</span>
            </div>
          )}
        </section>

        {/* Library Shelf Section Title */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#888888]">
            Library Shelf
          </h2>
          <span className="text-xs font-mono text-[#555555]">
            {userEmail ? `${books.length} ${books.length === 1 ? 'book' : 'books'}` : 'Locked'}
          </span>
        </div>

        {/* Guest View: Signed Out State */}
        {!userEmail ? (
          <div id="library-signed-out-state" className="border border-[#222222] rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-[#000000]">
            <div className="w-12 h-12 rounded-xl bg-[#000000] border border-[#222222] text-[#888888] flex items-center justify-center mb-4">
              <User className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1">Private Library</h3>
            <p className="text-xs text-[#888888] max-w-xs mb-5">
              Sign in to view your books. When logged out, books are kept hidden to protect your privacy.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#FFFFFF] text-[#000000] text-xs font-semibold hover:bg-[#E5E5E5] transition flex items-center gap-2"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Create Account</span>
            </button>
          </div>
        ) : filteredBooks.length === 0 ? (
          /* Empty State for Signed In User */
          <div id="library-empty-state" className="border border-[#222222] rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-[#000000]">
            <div className="w-12 h-12 rounded-xl bg-[#000000] border border-[#222222] text-[#888888] flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1">No books in your library</h3>
            <p className="text-xs text-[#888888] max-w-xs mb-5">
              Drop or upload a PDF to begin converting fixed documents into responsive pages.
            </p>
            <button
              id="btn-empty-upload"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#FFFFFF] text-[#000000] text-xs font-semibold hover:bg-[#E5E5E5] transition"
            >
              Select PDF file
            </button>
          </div>
        ) : (
          /* Book Cards Grid */
          <div id="book-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-16">
            {filteredBooks.map((book) => {
              // Calculate realistic effective total pages
              const effectiveTotalPages = Math.max(
                book.totalPages || 1,
                book.lastPageRead || 1,
                Math.ceil((book.totalWords || 0) / 220)
              );

              const lastRead = Math.max(1, book.lastPageRead || 1);
              const isFinished = lastRead >= effectiveTotalPages && effectiveTotalPages > 1;
              const rawPct = Math.round((lastRead / Math.max(1, effectiveTotalPages)) * 100);
              const progressPct = isFinished ? 100 : Math.min(99, Math.max(0, rawPct));

              // Estimated total reading time based on 220 wpm
              const totalEstWords = book.totalWords || Math.max(200, (book.totalPages || 1) * 220);
              const totalEstMins = Math.max(1, Math.round(totalEstWords / 220));
              const estHours = Math.floor(totalEstMins / 60);
              const estMinsRem = totalEstMins % 60;
              const estBookDuration = estHours > 0 
                ? (estMinsRem > 0 ? `${estHours}h ${estMinsRem}m` : `${estHours}h`)
                : `${totalEstMins}m`;

              // Actual reading time in minutes/hours
              const actualSecs = book.timeSpent || 0;
              const actualMins = Math.floor(actualSecs / 60);
              const readLabel = actualMins >= 60 
                ? `${(actualSecs / 3600).toFixed(1)}h read`
                : actualMins > 0 
                ? `${actualMins}m read`
                : `${actualSecs}s read`;

              return (
                <div
                  key={book.id}
                  id={`book-card-${book.id}`}
                  onClick={() => onSelectBook(book)}
                  className="group relative flex flex-col bg-[#000000] border border-[#222222] hover:border-[#444444] rounded-2xl overflow-hidden p-3.5 transition shadow-sm cursor-pointer select-none"
                >
                  {/* Book Card Graphic */}
                  <div className="h-32 rounded-xl bg-[#000000] border border-[#222222] flex flex-col justify-between p-3 mb-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-mono tracking-widest text-[#888888]">
                        KindleFlow
                      </span>
                      {book.bookmarks && book.bookmarks.length > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-[#888888] bg-[#000000] px-1.5 py-0.5 rounded border border-[#222222]">
                          <Bookmark className="w-2.5 h-2.5" />
                          {book.bookmarks.length}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-[#FFFFFF] line-clamp-2 leading-snug">
                        {book.title}
                      </h3>
                      <p className="text-[10px] font-mono text-[#888888] truncate mt-0.5">
                        {book.author || 'Unknown Author'}
                      </p>
                    </div>
                  </div>

                  {/* Metadata: Read Time & Progress */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#FFFFFF] mb-1">
                    <span className="flex items-center gap-1 text-[#CCCCCC]" title="Estimated total reading duration">
                      <BookOpen className="w-3 h-3 text-[#888888]" />
                      {estBookDuration}
                    </span>
                    <span className="font-semibold text-[#FFFFFF]">{progressPct}%</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[#666666] mb-2">
                    <span className="flex items-center gap-1" title="Time spent reading">
                      <Clock className="w-2.5 h-2.5 text-[#555555]" />
                      {readLabel}
                    </span>
                    <span>{formatDate(book.lastOpened)}</span>
                  </div>

                  {/* Monochrome Progress Bar */}
                  <div className="w-full bg-[#161616] h-1 rounded-full overflow-hidden mb-3">
                    <div
                      className="bg-[#FFFFFF] h-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#161616] text-[11px] text-[#888888]">
                    <button
                      id={`delete-btn-${book.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookToDelete(book);
                      }}
                      className="p-1 text-[#555555] hover:text-[#FFFFFF] transition"
                      title="Delete book"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="font-medium text-[#FFFFFF] group-hover:underline">
                      Read &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clean Footer */}
      <footer id="library-footer" className="mt-12 sm:mt-16 pt-6 sm:pt-8 pb-4 border-t border-[#1a1a1a] text-center text-xs text-[#666666]">
        <p>
          <a
            href="https://github.com/DaveChristopherr/KindleFlow"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#666666] hover:text-[#888888] no-underline font-normal transition-colors"
          >
            Created by Dave Christopher
          </a>
        </p>
      </footer>

      {/* Delete Confirmation Dialog */}
      {bookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[#000000] border border-[#222222] rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-[#FFFFFF] mb-2">Remove Document?</h3>
            <p className="text-xs text-[#888888] mb-6">
              Remove &quot;{bookToDelete.title}&quot; from your account library?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setBookToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-mono text-[#888888] hover:text-[#FFFFFF] rounded-xl hover:bg-[#111111] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteBook(bookToDelete.id);
                  setBookToDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#000000] bg-[#FFFFFF] hover:bg-[#E5E5E5] rounded-xl transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(email) => {
          onSignInSuccess(email);
          setIsAuthModalOpen(false);
        }}
      />

      {/* Account Dashboard Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        userEmail={userEmail}
        books={books}
        onSignOut={onSignOut}
      />
    </div>
  );
};
