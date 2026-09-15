import { Book, ReadingSettings } from '../types';
import { supabase } from '../lib/supabase';

const DB_NAME = 'KindleFlowDB';
const DB_VERSION = 2;
const STORE_BOOKS = 'books';
const STORE_SETTINGS = 'settings';

export const DEFAULT_SETTINGS: ReadingSettings = {
  theme: 'oled',
  font: 'serif',
  fontSize: 18,
  lineHeight: 1.7,
  marginWidth: 'balanced',
  animation: 'flip',
  brightness: 100,
};

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    return window.indexedDB;
  }
  return null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIndexedDB();
    if (!idb) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        const bookStore = db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        try {
          bookStore.createIndex('userId', 'userId', { unique: false });
        } catch {}
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get books for a specific user.
 * If user is not logged in (userId is null or empty), returns an empty array.
 */
export async function getBooks(userId: string | null): Promise<Book[]> {
  if (!userId) {
    return [];
  }

  const isSample = (b: Book) =>
    !b ||
    b.id.startsWith('sample-') ||
    b.id === 'art-of-war' ||
    b.id === 'metamorphosis' ||
    (typeof b.title === 'string' && (
      b.title.toLowerCase().includes('art of war') ||
      b.title.toLowerCase().includes('metamorphosis')
    ));

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.getAll();

      req.onsuccess = () => {
        let allBooks = (req.result as Book[]) || [];
        // Filter strictly by userId
        const userBooks = allBooks.filter((b) => !isSample(b) && b.userId === userId);
        resolve(userBooks);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB fallback reading:', err);
    try {
      const localKey = `kindleflow_books_${userId}`;
      const local = localStorage.getItem(localKey);
      if (local) {
        let parsed = JSON.parse(local) as Book[];
        parsed = parsed.filter((b) => !isSample(b) && b.userId === userId);
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }
}

/**
 * Save book associated with a user ID.
 */
export async function saveBook(book: Book, userId?: string | null): Promise<void> {
  const targetUserId = userId || book.userId;
  if (!targetUserId) {
    // Do not save books without a user ID
    return;
  }

  const bookToSave: Book = {
    ...book,
    userId: targetUserId,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      store.put(bookToSave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Fallback save to localStorage:', err);
    try {
      const localKey = `kindleflow_books_${targetUserId}`;
      const current = await getBooks(targetUserId);
      const updated = current.filter((b) => b.id !== bookToSave.id).concat([bookToSave]);
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch {}
  }

  // If Supabase is connected, optionally sync metadata to cloud
  if (supabase && targetUserId) {
    try {
      await supabase.from('books').upsert({
        id: bookToSave.id,
        user_id: targetUserId,
        title: bookToSave.title,
        author: bookToSave.author,
        total_pages: bookToSave.totalPages,
        last_page_read: bookToSave.lastPageRead,
        time_spent: bookToSave.timeSpent || 0,
        last_opened: bookToSave.lastOpened,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal if table doesn't exist yet
    }
  }
}

/**
 * Delete a book from database.
 */
export async function deleteBook(id: string, userId?: string | null): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Fallback delete from localStorage:', err);
    if (userId) {
      try {
        const localKey = `kindleflow_books_${userId}`;
        const current = await getBooks(userId);
        const updated = current.filter((b) => b.id !== id);
        localStorage.setItem(localKey, JSON.stringify(updated));
      } catch {}
    }
  }

  // If Supabase is connected, delete from cloud as well
  if (supabase && userId) {
    try {
      await supabase.from('books').delete().eq('id', id).eq('user_id', userId);
    } catch {}
  }
}

export async function getSavedSettings(): Promise<ReadingSettings> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get('user_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  } catch {
    try {
      const local = localStorage.getItem('kindleflow_settings');
      if (local) return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
    } catch {}
    return DEFAULT_SETTINGS;
  }
}

export async function saveUserSettings(settings: ReadingSettings): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put({ key: 'user_settings', value: settings });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    try {
      localStorage.setItem('kindleflow_settings', JSON.stringify(settings));
    } catch {}
  }
}
