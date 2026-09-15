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
import { supabase } from './utils/supabase';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [settings, setSettings] = useState<ReadingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  // Setup auth session listener
  useEffect(() => {
    let isMounted = true;

    async function initAuthAndData() {
      try {
        const loadedSettings = await getSavedSettings();
        if (isMounted) setSettings(loadedSettings);

        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          const email = session?.user?.email || null;
          if (isMounted) {
            setUserEmail(email);
            if (email) {
              const loadedBooks = await getBooks(email);
              if (isMounted) setBooks(loadedBooks);
            } else {
              setBooks([]);
            }
          }

          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const newEmail = session?.user?.email || null;
            if (isMounted) {
              setUserEmail(newEmail);
              if (newEmail) {
                const b = await getBooks(newEmail);
                if (isMounted) setBooks(b);
              } else {
                setBooks([]);
                setActiveBook(null);
              }
            }
          });

          return () => subscription.unsubscribe();
        } else {
          // Local account fallback
          const savedEmail = localStorage.getItem('kindleflow_session_user');
          if (isMounted) {
            setUserEmail(savedEmail);
            if (savedEmail) {
              const loadedBooks = await getBooks(savedEmail);
              if (isMounted) setBooks(loadedBooks);
            } else {
              setBooks([]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize KindleFlow:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initAuthAndData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignInSuccess = useCallback(async (email: string) => {
    localStorage.setItem('kindleflow_session_user', email);
    setUserEmail(email);
    const userBooks = await getBooks(email);
    setBooks(userBooks);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('kindleflow_session_user');
    setUserEmail(null);
    setBooks([]);
    setActiveBook(null);
  }, []);

  const handleSelectBook = useCallback((book: Book) => {
    const updatedBook = {
      ...book,
      lastOpened: new Date().toISOString(),
    };
    saveBook(updatedBook, userEmail);
    setActiveBook(updatedBook);
    setBooks((prev) => prev.map((b) => (b.id === book.id ? updatedBook : b)));
  }, [userEmail]);

  const handleDeleteBook = useCallback(async (bookId: string) => {
    await deleteBook(bookId, userEmail);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    setActiveBook((curr) => (curr?.id === bookId ? null : curr));
  }, [userEmail]);

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
      await saveBook(toSave, userEmail);
    }
  }, [userEmail]);

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
          saveBook(updated, userEmail);
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
  }, [userEmail]);

  const handleUpdateSettings = useCallback((newSettings: ReadingSettings) => {
    setSettings(newSettings);
    saveUserSettings(newSettings);
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-[100dvh] bg-black flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-white animate-spin mb-3" />
        <p className="text-xs font-mono text-[#888888] tracking-wider uppercase">
          Initializing KindleFlow...
        </p>
      </div>
    );
  }

  return (
    <div className="w-screen h-[100dvh] overflow-hidden bg-black flex flex-col">
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
          userEmail={userEmail}
          onSelectBook={handleSelectBook}
          onDeleteBook={handleDeleteBook}
          onBookAdded={handleBookAdded}
          onSignOut={handleSignOut}
          onSignInSuccess={handleSignInSuccess}
        />
      )}
    </div>
  );
        }
