# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CIIM (CARM iManage Instruction Manual) is a web app for CARM Consulting Inc. ~25 iManage migration customers log in, fill out a form with migration-specific values, and receive a personalized manual — rendered in the browser and downloadable as a PDF via browser print (`window.print()`).

Deployed on Vercel. CARM admins manage customers and upload the Word template via `/admin`.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) — uses `proxy.ts` not `middleware.ts` |
| Auth | Clerk v7 (`@clerk/nextjs`) |
| Database | Supabase Postgres (`@supabase/supabase-js` v2) |
| UI | Tailwind CSS v4 + shadcn/ui |
| Word → HTML | mammoth.js |
| PDF | Browser `window.print()` + `@media print` CSS |

## Development Commands

```bash
npm run dev          # Start local dev server at localhost:3000
npm run build        # Production build (also runs TypeScript check)
npm run lint         # ESLint
```

## Key Architecture Notes

### Next.js 16 Breaking Changes
- **`middleware.ts` is deprecated** — this project uses `src/proxy.ts` with a named `proxy` export (or default export). Clerk's `clerkMiddleware` is used as the default export.
- The file convention is `proxy.ts`, not `middleware.ts`.

### Route Group Structure
```
src/app/
  (public)/sign-in/[[...sign-in]]/   -- Clerk sign-in page
  (customer)/                         -- layout guards: Clerk auth required
    dashboard/                        -- form: all 46 migration fields
    manual/                           -- merged manual + PDF print button
  (admin)/                            -- layout guards: role="admin" required
    admin/customers/                  -- list, create, edit customers
    admin/template/                   -- upload .docx, view active template
  api/admin/template-upload/          -- POST: .docx → HTML conversion
  actions/                            -- Server Actions (form-values.ts, customers.ts)
```

### Data Model (Supabase)
Four tables, all with RLS enabled (service role key bypasses RLS for all server-side writes):
- `customers` — one row per client company, linked to `clerk_user_id`
- `form_values` — key-value store: one row per field per customer (all 46 fields)
- `template_versions` — each uploaded .docx generates a new version; `is_active = true` is the live one
- `template_sections` — maps boolean field keys to `data-section` IDs in the HTML template

Migration SQL: `supabase/migrations/001_initial.sql`

### Field Catalog (`src/lib/fields.ts`)
Three field categories:
- **Text fields** (22): company info, IT contact, iManage Cloud config, timeline, misc
- **Credential fields** (4): `cloudadmin_email/password`, `imanadmin_email/password` — AES-256-GCM encrypted before storage, **never rendered in the manual or PDF**
- **Boolean toggle fields** (20): stored as `"x"` (checked) or `""` (unchecked) — control section visibility in the manual

### Template Pipeline
1. Admin uploads `.docx` → `POST /api/admin/template-upload`
2. `src/lib/docx-processor.ts` runs mammoth.js, replaces `«field»` → `{{field}}`, wraps boolean sections in `<div data-section="FieldKey">`
3. Processed HTML stored in `template_versions.html_content`
4. Customer views `/manual` → `src/lib/template-engine.ts` substitutes `{{field}}` values, applies `style="display:none"` to unchecked sections

### Supabase Client Usage
- `createServiceClient()` — server-only (Server Actions, Route Handlers, Server Components). Uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS.
- `createBrowserClient()` — available but not currently used (all data access is server-side).

### Authentication
- Clerk user metadata: `role: "admin"` in `sessionClaims.metadata` = admin access
- `src/proxy.ts` redirects unauthenticated users to `/sign-in`, redirects non-admins away from `/admin/*`
- All Server Actions re-check auth via `auth()` from `@clerk/nextjs/server` — do not rely on proxy alone

### Credential Encryption (`src/lib/encryption.ts`)
AES-256-GCM. Format stored in DB: `{iv_hex}:{tag_hex}:{ciphertext_hex}`. `ENCRYPTION_KEY` must be a 32-byte hex string (`openssl rand -hex 32`).

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-only

ENCRYPTION_KEY                   # 32-byte hex: openssl rand -hex 32
```

See `.env.local.example` for a template.

## UI & Design Guidelines

### Typography
**Font**: Source Sans 3 (Google Fonts) — Adobe's open-source typeface, the closest free equivalent to Adobe Clean. Loaded via `next/font/google` in `src/app/layout.tsx` at weights 300/400/600/700. Monospace: Source Code Pro.

**Type scale** (matches Adobe Business proportions):
- Body: 1rem / 1.6 line-height / color `#2c2c2c`
- H1: 2.25rem / weight 700 / line-height 1.2 / letter-spacing -0.01em
- H2: 1.625rem / weight 700 / line-height 1.25
- H3: 1.25rem / weight 600 / line-height 1.3
- H4: 1.0625rem / weight 600 / line-height 1.4
- Heading color: `#1a1a1a`

### Navigation
Horizontal bar with `border-b border-gray-200` on white. Brand name left-anchored (`font-semibold tracking-tight`). Nav links use `border-b-2 border-transparent hover:border-gray-900` underline-on-hover pattern. Full bar height via `items-stretch` with `py-4` on the brand name. Content area padding bumped to `p-8`.

### Component Library
Use **shadcn/ui** components exclusively — do not introduce other UI libraries. Installed components: `button`, `input`, `checkbox`, `label`, `card`, `separator`, `badge`. Add new shadcn components with `npx shadcn@latest add <component>`.

### Layout & Spacing
- Page content: `max-w-3xl` with `space-y-8` between sections, `px-6 py-10` padding
- Manual page: `max-w-4xl` to accommodate wider document content
- Section grouping: wrap related fields in `<Card>` with `<CardHeader>` + `<CardContent>`
- Card titles: `text-base` weight; page titles: `text-2xl font-bold text-gray-900`
- Secondary/hint text: `text-sm text-gray-500` or `text-xs text-gray-500`

### Color Conventions
The theme is neutral (no brand color yet — all grays). Use semantic colors only:
- Errors: `text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2`
- Success/active states: `text-green-700`
- Links in the manual: `#2563eb` (blue-600)
- Danger zone borders: `border-red-200` with `text-red-700` title
- Do not introduce new accent colors without discussing first

### Forms & Error Handling
- Server Actions used in forms must use `useActionState` (React 19) — **never** bind a throwing action directly to `<form action={...}>` without state capture
- Error messages render above the submit button inside the form card
- Pending state: disable the submit button and change label to `"Saving…"` / `"Creating…"`

### Admin Chrome
- Sticky top header: `border-b bg-white px-6 py-3 flex items-center justify-between`
- Nav links: `text-sm text-gray-600 hover:text-gray-900`

### Manual Page
- Manual content lives in a `<div className="ciim-manual">` — styled with a `<style>` tag of plain CSS (not Tailwind), because the HTML is dynamically generated by mammoth
- Toolbar above the manual: sticky, `print:hidden`, with ← back link + PrintButton
- Unfilled placeholders render with class `ciim-missing` (amber highlight in browser, invisible in print)
- `@media print`: 1-inch margins, `page-break-before: always` on `h1`, avoid breaks after `h2`/`h3`

## Supabase Setup

1. Create a new Supabase project
2. Run `supabase/migrations/001_initial.sql` in the SQL editor
3. Create a Storage bucket named `templates` (the migration does this, but verify)
4. Copy the project URL, anon key, and service role key into `.env.local`
