import * as pdfjsLib from 'pdfjs-dist';
import { Book, Chapter } from '../types';

// Configure PDF.js worker for browser environment
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface TextItemWithLayout {
  str: string;
  fontSize: number;
  y: number;
  x: number;
}

/**
 * Remove hyphenation across line breaks
 */
function cleanHyphens(text: string): string {
  return text
    .replace(/([A-Za-z0-9]+)-\s*\n\s*([A-Za-z0-9]+)/g, '$1$2')
    .replace(/([A-Za-z0-9]+)\xad\s*([A-Za-z0-9]+)/g, '$1$2')
    .replace(/([A-Za-z]{2,})-\s+([a-z]{2,})/g, '$1$2');
}

/**
 * Detect page number artifacts and headers
 */
function isArtifact(line: string): boolean {
  const s = line.trim();
  if (!s) return true;
  // Standalone numbers or bracketed page numbers
  if (/^[-—–\s\[(]*\d+[-—–\s\])]*$/.test(s)) return true;
  // 'Page X of Y' or 'p. 14'
  if (/^(?:page|p\.?)\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(s)) return true;
  return false;
}

/**
 * Detect chapter headings based on regex and font size ratio
 */
function isHeading(text: string, currentFontSize: number, avgFontSize: number): boolean {
  const s = text.trim();
  if (!s || s.length > 110) return false;

  const chapterRegex = /^(?:chapter|part|section|book|act|scene|canto)\s+([0-9ivxlcdm]+|[a-z]+)[\s:.\-]*(.*)$/i;
  if (chapterRegex.test(s)) return true;

  const standaloneTitles = new Set([
    'prologue', 'epilogue', 'introduction', 'preface', 'foreword',
    'afterword', 'conclusion', 'table of contents', 'contents',
    'acknowledgments', 'about the author', 'appendix'
  ]);
  if (standaloneTitles.has(s.toLowerCase())) return true;

  // Font size substantially larger than body text (30%+ larger)
  if (avgFontSize > 0 && currentFontSize >= avgFontSize * 1.3 && s.length < 80) {
    return true;
  }

  // Short all-caps line ONLY if noticeably larger than regular text or matching chapter keywords
  if (
    s === s.toUpperCase() && 
    s.length >= 4 && 
    s.length < 50 && 
    !/[.,;]$/.test(s) &&
    avgFontSize > 0 &&
    currentFontSize >= avgFontSize * 1.2
  ) {
    return true;
  }

  return false;
}

/**
 * High-performance PDF extraction pipeline with cooperative multitasking
 */
export async function parsePdfFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<Book> {
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.('Initializing PDF parser...');
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let docTitle = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  let docAuthor = 'Unknown Author';

  try {
    const metadata = await pdfDoc.getMetadata();
    const info = metadata?.info as Record<string, unknown> | undefined;
    if (info) {
      if (typeof info.Title === 'string' && info.Title.trim()) {
        docTitle = info.Title.trim();
      }
      if (typeof info.Author === 'string' && info.Author.trim()) {
        docAuthor = info.Author.trim();
      }
    }
  } catch {
    // Non-fatal, fallback to filename
  }

  // First pass: sample font sizes across first 5 pages to compute median body font size
  const sampledFontSizes: number[] = [];
  const sampleLimit = Math.min(numPages, 5);

  for (let i = 1; i <= sampleLimit; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ('str' in item && item.str.trim().length > 3) {
        const fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12;
        sampledFontSizes.push(fontSize);
      }
    }
    if (typeof page.cleanup === 'function') {
      page.cleanup();
    }
  }

  sampledFontSizes.sort((a, b) => a - b);
  const avgFontSize = sampledFontSizes.length > 0 
    ? sampledFontSizes[Math.floor(sampledFontSizes.length / 2)] 
    : 12;

  // Second pass: extract structured chapters and paragraphs with cooperative event-loop yields
  const chapters: Chapter[] = [];
  let currentChapterTitle = 'Introduction';
  let currentParagraphs: string[] = [];
  let totalWordCount = 0;

  const commitChapter = () => {
    const cleanParas = currentParagraphs.map(p => p.trim()).filter(Boolean);
    if (cleanParas.length > 0) {
      const wordsInChapter = cleanParas.join(' ').split(/\s+/).length;
      // If the extracted chapter has fewer than 30 words and a prior chapter exists,
      // append to prior chapter to prevent fragmented 1-sentence pages!
      if (wordsInChapter < 30 && chapters.length > 0) {
        chapters[chapters.length - 1].content.push(...cleanParas);
      } else {
        chapters.push({
          id: `ch-${chapters.length + 1}`,
          title: currentChapterTitle || `Section ${chapters.length + 1}`,
          content: cleanParas,
        });
      }
    }
    currentParagraphs = [];
  };

  let lastYieldTime = performance.now();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    // Cooperatively yield when frame budget is exceeded to maintain responsive UI
    if (performance.now() - lastYieldTime > 25) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      lastYieldTime = performance.now();
      const pct = Math.round((pageNum / numPages) * 100);
      onProgress?.(`Extracting page ${pageNum} of ${numPages} (${pct}%)...`);
    }

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group items by line based on vertical position (y coordinate)
    const items: TextItemWithLayout[] = [];
    for (const item of textContent.items) {
      if ('str' in item) {
        const fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12;
        items.push({
          str: item.str,
          fontSize,
          x: item.transform[4],
          y: item.transform[5],
        });
      }
    }

    // Sort items top-to-bottom, left-to-right
    items.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 3) {
        return b.y - a.y; // Higher Y is higher on page in PDF coordinates
      }
      return a.x - b.x;
    });

    // Group items into text lines
    const lines: { text: string; maxFontSize: number }[] = [];
    let currentLineText = '';
    let currentLineY = -9999;
    let currentLineMaxFont = 0;

    for (const it of items) {
      if (currentLineY === -9999 || Math.abs(it.y - currentLineY) <= 3) {
        currentLineText += (currentLineText && !currentLineText.endsWith(' ') ? ' ' : '') + it.str;
        currentLineMaxFont = Math.max(currentLineMaxFont, it.fontSize);
        currentLineY = it.y;
      } else {
        if (currentLineText.trim()) {
          lines.push({ text: currentLineText.trim(), maxFontSize: currentLineMaxFont });
        }
        currentLineText = it.str;
        currentLineMaxFont = it.fontSize;
        currentLineY = it.y;
      }
    }
    if (currentLineText.trim()) {
      lines.push({ text: currentLineText.trim(), maxFontSize: currentLineMaxFont });
    }

    // Group lines into paragraphs & detect chapter titles
    let activePara = '';

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const lineObj = lines[lIdx];
      const line = lineObj.text;
      if (isArtifact(line)) continue;

      if (isHeading(line, lineObj.maxFontSize, avgFontSize)) {
        if (activePara.trim()) {
          currentParagraphs.push(cleanHyphens(activePara.trim()));
          totalWordCount += activePara.split(/\s+/).length;
          activePara = '';
        }
        commitChapter();
        currentChapterTitle = line;
      } else {
        const isSentenceEnd = /[.!?]["']?$/.test(activePara.trim());
        const startsWithCap = /^[A-Z"']/.test(line);
        const isLongPara = activePara.length > 300;
        const isHugePara = activePara.length > 1500;

        // Paragraph boundary detection
        if (isSentenceEnd && ((startsWithCap && isLongPara) || isHugePara)) {
          currentParagraphs.push(cleanHyphens(activePara.trim()));
          totalWordCount += activePara.split(/\s+/).length;
          activePara = line;
        } else {
          activePara = activePara ? `${activePara} ${line}` : line;
        }
      }
    }

    if (activePara.trim()) {
      currentParagraphs.push(cleanHyphens(activePara.trim()));
      totalWordCount += activePara.split(/\s+/).length;
      activePara = '';
    }

    if (typeof page.cleanup === 'function') {
      page.cleanup();
    }
  }

  commitChapter();

  try {
    if (typeof (pdfDoc as { cleanup?: () => void }).cleanup === 'function') {
      (pdfDoc as { cleanup?: () => void }).cleanup?.();
    }
  } catch {
    // Non-fatal cleanup
  }

  // Fallback if no chapters were recognized
  if (chapters.length === 0) {
    chapters.push({
      id: 'ch-1',
      title: docTitle,
      content: ['Document text could not be extracted as standard paragraphs.'],
    });
  }

  const estimatedPages = Math.max(numPages, Math.ceil(totalWordCount / 220));

  const book: Book = {
    id: `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: docTitle,
    author: docAuthor,
    totalPages: estimatedPages,
    totalWords: totalWordCount,
    fileSize: file.size,
    filename: file.name,
    lastPageRead: 1,
    lastOpened: new Date().toISOString(),
    bookmarks: [],
    chapters,
  };

  return book;
}
