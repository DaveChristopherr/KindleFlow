import { Book, ReflowPage, ReadingSettings } from '../types';

let cachedCanvas: HTMLCanvasElement | null = null;
let cachedCtx: CanvasRenderingContext2D | null = null;

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!cachedCanvas) {
    cachedCanvas = document.createElement('canvas');
    cachedCtx = cachedCanvas.getContext('2d');
  }
  return cachedCtx;
}

/**
 * Wraps text into lines using Canvas 2D measurement for maximum performance.
 * Completely avoids DOM layout thrashing and executes in microseconds.
 */
function wrapLines(
  text: string,
  ctx: CanvasRenderingContext2D | null,
  maxWidth: number,
  fontSize: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  if (!ctx) {
    // Fallback: character-width estimation if canvas is unavailable
    const avgCharWidth = fontSize * 0.52;
    const maxChars = Math.max(15, Math.floor(maxWidth / avgCharWidth));
    const lines: string[] = [];
    let curLine = '';

    for (const w of words) {
      if (!curLine) {
        curLine = w;
      } else if (curLine.length + 1 + w.length <= maxChars) {
        curLine += ' ' + w;
      } else {
        lines.push(curLine);
        curLine = w;
      }
    }
    if (curLine) lines.push(curLine);
    return lines;
  }

  const spaceWidth = ctx.measureText(' ').width;
  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let wordWidth = ctx.measureText(word).width;

    // Handle single words that exceed the entire line width
    if (wordWidth > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
        currentWidth = 0;
      }
      let chunk = '';
      let chunkWidth = 0;
      for (const char of word) {
        const charWidth = ctx.measureText(char).width;
        if (chunkWidth + charWidth > maxWidth && chunk.length > 0) {
          lines.push(chunk);
          chunk = char;
          chunkWidth = charWidth;
        } else {
          chunk += char;
          chunkWidth += charWidth;
        }
      }
      if (chunk) {
        currentLine = chunk;
        currentWidth = chunkWidth;
      }
      continue;
    }

    if (!currentLine) {
      currentLine = word;
      currentWidth = wordWidth;
    } else if (currentWidth + spaceWidth + wordWidth <= maxWidth) {
      currentLine += ' ' + word;
      currentWidth += spaceWidth + wordWidth;
    } else {
      lines.push(currentLine);
      currentLine = word;
      currentWidth = wordWidth;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Calculates responsive paginated reflow pages for the entire book
 * using a high-performance Canvas 2D line budgeting engine.
 */
export function calculateReflowPages(
  book: Book,
  containerWidth: number,
  containerHeight: number,
  settings: ReadingSettings
): ReflowPage[] {
  if (typeof document === 'undefined' || !book || !book.chapters || book.chapters.length === 0) {
    return [];
  }

  // Margin width constraints
  let maxWidth = 700;
  let horizontalPadding = 32;

  if (settings.marginWidth === 'compact') {
    maxWidth = Math.min(containerWidth - 24, 620);
    horizontalPadding = 16;
  } else if (settings.marginWidth === 'balanced') {
    maxWidth = Math.min(containerWidth - 48, 720);
    horizontalPadding = 24;
  } else if (settings.marginWidth === 'wide') {
    maxWidth = Math.min(containerWidth - 64, 820);
    horizontalPadding = 40;
  }

  const effectiveWidth = Math.max(260, maxWidth - horizontalPadding * 2);
  // Accurate vertical clearance accounting for running header, footer, and padding
  const verticalChrome = containerHeight > 600 ? 140 : 120;
  const effectiveHeight = Math.max(220, containerHeight - verticalChrome);

  // Setup offscreen canvas typography
  const ctx = getCanvasContext();
  let fontFamily = "'Charis SIL', 'Literata', 'Merriweather', Georgia, serif";
  if (settings.font === 'newsreader') fontFamily = "'Newsreader', Georgia, serif";
  else if (settings.font === 'sans') fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
  else if (settings.font === 'mono') fontFamily = "'JetBrains Mono', monospace";

  if (ctx) {
    ctx.font = `${settings.fontSize}px ${fontFamily}`;
  }

  const lineHeightRatio = typeof settings.lineHeight === 'number' ? settings.lineHeight : 1.7;
  const lineHeightPx = Math.round(settings.fontSize * lineHeightRatio);
  const paraSpacingPx = Math.round(settings.fontSize * 0.7);
  const titleHeightPx = Math.round(settings.fontSize * 1.35 * 1.3) + 16;

  const pages: ReflowPage[] = [];

  let currentHeight = 0;
  let currentPageParas: string[] = [];
  let activeParaLines: string[] = [];
  let currentPageChapterTitle = book.chapters[0]?.title || book.title;
  let currentPageChapterIndex = 0;
  let isChapterStart = true;

  const flushActivePara = () => {
    if (activeParaLines.length > 0) {
      currentPageParas.push(activeParaLines.join(' '));
      activeParaLines = [];
    }
  };

  const commitPage = () => {
    flushActivePara();
    if (currentPageParas.length > 0) {
      pages.push({
        pageNumber: pages.length + 1,
        chapterIndex: currentPageChapterIndex,
        chapterTitle: currentPageChapterTitle,
        paragraphs: [...currentPageParas],
        isChapterStart,
      });
      isChapterStart = false;
      currentPageParas = [];
      currentHeight = 0;
    }
  };

  book.chapters.forEach((chapter, chapterIndex) => {
    // Check if this chapter represents a major division that warrants a new page
    const isMajorChapter = /^(?:chapter|part|book|section\s+\d+)/i.test(chapter.title.trim());
    const hasExistingContent = currentPageParas.length > 0 || activeParaLines.length > 0;

    // Only force a new page for major chapters or if the current page is already well-filled
    if (hasExistingContent && (isMajorChapter || currentHeight >= effectiveHeight * 0.5)) {
      commitPage();
      isChapterStart = true;
    }

    currentPageChapterTitle = chapter.title;
    currentPageChapterIndex = chapterIndex;

    for (const para of chapter.content) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      const lines = wrapLines(trimmed, ctx, effectiveWidth, settings.fontSize);
      if (lines.length === 0) continue;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isLastLine = i === lines.length - 1;
        const lineCost = lineHeightPx + (isLastLine ? paraSpacingPx : 0);
        const maxPageHeight = isChapterStart ? Math.max(120, effectiveHeight - titleHeightPx) : effectiveHeight;

        // If line exceeds page budget:
        if (currentHeight + lineCost > maxPageHeight && (activeParaLines.length > 0 || currentPageParas.length > 0)) {
          // If this is the very last line of a paragraph, slightly expand budget to fit it rather than stranding 1 sentence alone
          if (isLastLine && currentHeight + lineCost <= maxPageHeight + lineHeightPx * 0.75) {
            activeParaLines.push(line);
            currentHeight += lineCost;
            continue;
          }

          commitPage();
        }

        activeParaLines.push(line);
        currentHeight += lineCost;
      }
      flushActivePara();
    }
  });

  if (activeParaLines.length > 0 || currentPageParas.length > 0) {
    commitPage();
  }

  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      chapterIndex: 0,
      chapterTitle: book.title,
      paragraphs: ['(No reflowable content detected)'],
      isChapterStart: true,
    });
  }

  return pages;
}
