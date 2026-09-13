/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Book, ReadingSettings } from './types';
import { 
  getBooks, 
  saveBook, 
  deleteBook, 
  getSavedSettings, 
  saveUserSettings, 
  DEFAULT_SETTINGS 
} from './utils/db';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [settings, setSettings] = useState<ReadingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  // Load books & settings from IndexedDB on initial mount
  useEffect(() => {
    async function initData() {
      try {
        const [loadedBooks, loadedSettings] = await Promise.all([
          getBooks(),
          getSavedSettings(),
        ]);
        setBooks(loadedBooks);
        setSettings(loadedSettings);
      } catch (err) {
        console.error('Failed to initialize KindleFlow data:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  const handleSelectBook = useCallback((book: Book) => {
    const updatedBook = {
      ...book,
      lastOpened: new Date().toISOString(),
    };
    saveBook(updatedBook);
    setActiveBook(updatedBook);
    setBooks((prev) => prev.map((b) => (b.id === book.id ? updatedBook : b)));
  }, []);

  const handleDeleteBook = useCallback(async (bookId: string) => {
    await deleteBook(bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    setActiveBook((curr) => (curr?.id === bookId ? null : curr));
  }, []);

  const handleBookAdded = useCallback((newBook: Book) => {
    setBooks((prev) => [newBook, ...prev]);
  }, []);

  const handleBackToLibrary = useCallback(() => {
    setActiveBook(null);
  }, []);

  const handleUpdateProgress = useCallback(async (bookId: string, pageNumber: number, timeSpent?: number) => {
    let toSave: Book | null = null;
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          if (b.lastPageRead === pageNumber && (timeSpent === undefined || b.timeSpent === timeSpent)) return b;
          const updated = { 
            ...b, 
            lastPageRead: pageNumber, 
            lastOpened: new Date().toISOString(),
            timeSpent: timeSpent !== undefined ? timeSpent : b.timeSpent
          };
          toSave = updated;
          return updated;
        }
        return b;
      })
    );
    if (toSave) {
      await saveBook(toSave);
    }
  }, []);

  const handleToggleBookmark = useCallback(async (bookId: string, pageNumber: number) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const currentBms = b.bookmarks || [];
          const exists = currentBms.includes(pageNumber);
          const newBms = exists
            ? currentBms.filter((p) => p !== pageNumber)
            : [...currentBms, pageNumber];
          const updated = { ...b, bookmarks: newBms };
          saveBook(updated);
          return updated;
        }
        return b;
      })
    );
    setActiveBook((curr) => {
      if (curr?.id === bookId) {
        const currentBms = curr.bookmarks || [];
        const exists = currentBms.includes(pageNumber);
        const newBms = exists
          ? currentBms.filter((p) => p !== pageNumber)
          : [...currentBms, pageNumber];
        return { ...curr, bookmarks: newBms };
      }
      return curr;
    });
  }, []);

  const handleUpdateSettings = useCallback((newSettings: ReadingSettings) => {
    setSettings(newSettings);
    saveUserSettings(newSettings);
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-white animate-spin mb-3" />
        <p className="text-xs font-mono text-[#888888] tracking-wider uppercase">
          Initializing KindleFlow...
        </p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-black flex flex-col">
      {activeBook ? (
        <ReaderView
          book={activeBook}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onBackToLibrary={handleBackToLibrary}
          onUpdateProgress={handleUpdateProgress}
          onToggleBookmark={handleToggleBookmark}
        />
      ) : (
        <LibraryView
          books={books}
          onSelectBook={handleSelectBook}
          onDeleteBook={handleDeleteBook}
          onBookAdded={handleBookAdded}
        />
      )}
    </div>
  );
}
