/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, ReadingSettings } from '../types';

const DB_NAME = 'KindleFlowDB';
const DB_VERSION = 1;
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
        db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getBooks(): Promise<Book[]> {
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
        let books = (req.result as Book[]) || [];
        // Ensure library starts strictly empty until user uploads a PDF
        const samples = books.filter(isSample);
        if (samples.length > 0) {
          try {
            const cleanTx = db.transaction(STORE_BOOKS, 'readwrite');
            const cleanStore = cleanTx.objectStore(STORE_BOOKS);
            samples.forEach((s) => cleanStore.delete(s.id));
          } catch {
            // ignore
          }
          books = books.filter((b) => !isSample(b));
        }
        resolve(books);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB fallback to localStorage:', err);
    try {
      const local = localStorage.getItem('kindleflow_books');
      if (local) {
        let parsed = JSON.parse(local) as Book[];
        parsed = parsed.filter((b) => !isSample(b));
        localStorage.setItem('kindleflow_books', JSON.stringify(parsed));
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }
}

export async function saveBook(book: Book): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      store.put(book);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Fallback save to localStorage:', err);
    try {
      const current = await getBooks();
      const updated = current.filter(b => b.id !== book.id).concat([book]);
      localStorage.setItem('kindleflow_books', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
}

export async function deleteBook(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Fallback delete from localStorage:', err);
    try {
      const current = await getBooks();
      const updated = current.filter(b => b.id !== id);
      localStorage.setItem('kindleflow_books', JSON.stringify(updated));
    } catch {
      // ignore
    }
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
