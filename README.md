# KindleFlow

### Reflowable E-Reader for PDF Documents

KindleFlow is an open-source, high-performance web-based e-reader designed to transform fixed-layout PDF documents into responsive, reflowable e-book pages. Traditional PDF viewers rely on static page scaling, forcing readers to pinch, zoom, and scroll horizontally on mobile devices and smaller screens. KindleFlow extracts document text, detects structural sections, and repaginates content smoothly across any screen resolution.

---

## Why I Built This

I built KindleFlow as a personal project to solve a frustrating problem I kept running into: reading book-length PDF files on my phone and computer.

Whenever I opened PDF books in apps like Google Play Books or standard document viewers, it was an exhausting reading experience. Because PDFs have fixed page dimensions, the text never adapts to phone or tablet screens. I was constantly pinching to zoom in, panning left and right to read each sentence, and losing my place on the page. Converting files to EPUB often broke formatting or took annoying extra steps.

I wanted something clean and distraction-free that works like a Kindle but natively for PDF files. KindleFlow takes any PDF book, parses the text directly in the browser, reflows it to match your exact screen size, and lets you read naturally without ever having to pinch or zoom again.

---

## Features

- Continuous text reflow: Turns fixed-layout PDF pages into responsive book pages that fit any screen size.
- Zero-lag pagination engine: Uses an offscreen HTML5 Canvas 2D measurement buffer for sub-25ms page recalculation.
- Session reading timer: Displays active reading time spent in the current document directly in the reader bar.
- Auto-save visual indicator: Automatically saves reading progress to browser IndexedDB with a subtle confirmation indicator on page changes.
- OLED Black mode (#000000) alongside Sepia Paper and Crisp White reading canvases.
- Adjustable font size (A- / A+), software brightness slider, and Table of Contents drawer.
- Pure client-side privacy: Documents and reading history remain stored locally in your browser.
- Fully responsive layout: Seamless reading experience across mobile phones, tablets, laptops, and desktop screens with touch gestures and keyboard shortcuts.

---

## How It Works

### High-Performance Canvas Line-Budgeting Engine
Traditional web readers often suffer from severe lag during pagination due to repeated DOM measurements (`innerHTML` updates and `offsetHeight` recalculations) inside nested binary search loops. KindleFlow eliminates this bottleneck entirely by utilizing an offscreen HTML5 Canvas 2D rendering context to compute exact word and line measurements in memory.

- Zero DOM layout thrashing during pagination recalculations.
- Instantaneous font resizing (A- / A+) and window resizing with zero frame drops.
- Capable of paginating 100,000+ words in under 25 milliseconds.

### Cooperative Multitasking PDF Parser
Large PDF files (including multi-megabyte documents with hundreds of pages) are processed using cooperative event-loop yielding:
- Processing yields execution every 25 milliseconds, ensuring the browser UI remains completely fluid and responsive.
- Every page triggers automatic memory disposal (`page.cleanup()`), preventing tab crashes and memory leaks.
- Smart heading detection and hyphenation cleanup across line breaks.

### Offline-First Architecture & Privacy
- Zero cloud database dependency: Your books, reading positions, and bookmarks stay in your device's IndexedDB.
- No network transmission: Uploaded documents are parsed strictly inside the client runtime.
- Instant resume: Reopening a book immediately restores your exact page and reading progress.

---

## Supported Documents

- Standard text-based PDF documents, technical books, manuals, and literature.
- Text reflow operates on readable character streams; scanned image-only PDFs should be OCR-processed beforehand for optimal reflow parsing.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

