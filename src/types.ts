/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Chapter {
  id: string;
  title: string;
  content: string[];
  images?: {
    data: string;
    alt?: string;
    page?: number;
  }[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  totalWords: number;
  timeSpent?: number;
  fileSize?: number;
  filename?: string;
  lastPageRead: number;
  lastOpened: string;
  bookmarks: number[];
  chapters: Chapter[];
  coverColor?: string;
}

export interface ReflowPage {
  pageNumber: number;
  chapterIndex: number;
  chapterTitle: string;
  paragraphs: string[];
  isChapterStart: boolean;
  images?: {
    data: string;
    alt?: string;
  }[];
}

export type ThemeMode = 'oled' | 'sepia' | 'light';
export type FontMode = 'serif' | 'newsreader' | 'sans' | 'mono';
export type AnimationMode = 'flip' | 'slide';
export type MarginWidth = 'compact' | 'balanced' | 'wide';

export interface ReadingSettings {
  theme: ThemeMode;
  font: FontMode;
  fontSize: number;
  lineHeight: number;
  marginWidth: MarginWidth;
  animation: AnimationMode;
  brightness: number;
}
