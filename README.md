# KindleFlow

> Reflowable, responsive Kindle-style e-reader for PDF documents with OLED dark mode, canvas line budgeting, and Supabase cloud accounts.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-DaveChristopherr%2FKindleFlow-181717?logo=github)](https://github.com/DaveChristopherr/KindleFlow)

Developed by **Dave Christopher** ([@DaveChristopherr](https://github.com/DaveChristopherr))  
Website: [davechristopher.me](https://davechristopher.me/)  
Repository: [https://github.com/DaveChristopherr/KindleFlow](https://github.com/DaveChristopherr/KindleFlow)

---

## Overview

Traditional PDF viewers rely on static page scaling, forcing readers to pinch, zoom, and scroll horizontally on mobile phones and tablets. **KindleFlow** solves this problem by parsing PDF text and reflowing it into dynamic, paginated e-book pages that comfortably adapt to any screen dimension.

KindleFlow provides:
- **Reflowable PDF Pagination**: Converts fixed-layout PDFs into responsive, clean e-book pages.
- **Sub-25ms Pagination Engine**: Offscreen HTML5 Canvas 2D line measurement avoids DOM layout thrashing.
- **OLED Dark Mode & Aesthetic**: Built with deep black backgrounds (`#000000`) and subtle borders (`#222222`), ideal for OLED displays and battery savings.
- **Account & Cloud Sync**: Sign in with email to isolate your private library. Books are hidden when logged out and restored when logged in.
- **Actual Reading Time**: Tracks exact minutes and hours spent reading across your library in your Account Dashboard.
- **Table of Contents & Jump-to-Page**: Clean chapter navigation drawer with page badges and direct page jumping for documents with hundreds of pages.
- **Privacy First**: All PDF parsing is performed directly in your browser.

---

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/DaveChristopherr/KindleFlow.git

# Navigate into project directory
cd KindleFlow

# Install dependencies
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
```

The compiled static files will be generated in the `dist` directory.

---

## Supabase Setup (Authentication & Cloud Database)

KindleFlow supports user accounts and cloud synchronization via Supabase.

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > API** to get your **Project URL** and **anon public key**.
3. Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
4. In Supabase, enable **Email Auth** under **Authentication > Providers**.
5. (Optional) Run the following SQL query in the Supabase SQL Editor if you want to store books in a Postgres table:
   ```sql
   create table public.books (
     id text primary key,
     user_id text not null,
     title text not null,
     author text,
     total_pages integer,
     last_page_read integer default 1,
     time_spent integer default 0,
     last_opened timestamptz default now(),
     updated_at timestamptz default now()
   );

   alter table public.books enable row level security;

   create policy "Users can manage their own books"
     on public.books for all
     using (auth.uid()::text = user_id);
   ```

---

## Deploy to Vercel

1. Push your repository to GitHub: `git push origin main`
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your `KindleFlow` repository.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
5. Click **Deploy**. Vercel will automatically build and publish your site at `https://your-project.vercel.app`.

---

## Tech Stack

- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **PDF Engine**: Mozilla's `pdfjs-dist`
- **Database & Auth**: Supabase (`@supabase/supabase-js`) & IndexedDB
- **Icons**: `lucide-react`

---

## Author

Created by **Dave Christopher**  
GitHub: [https://github.com/DaveChristopherr](https://github.com/DaveChristopherr)  
Repository: [https://github.com/DaveChristopherr/KindleFlow](https://github.com/DaveChristopherr/KindleFlow)

---

## License

This project is licensed under the [MIT License](LICENSE).
