# procuredesk-dms# ProcureDesk — Cloud Document Management System

A cloud-based **Document Management System (DMS)** for procurement-focused small businesses. It keeps tenders, contracts, vendor records, purchase orders, and standard operating procedures (SOPs) in one secure, searchable place — so institutional knowledge and documents stay with the business when staff move on.

Built with **React + Vite** on the front end and **Supabase** (PostgreSQL, Auth, Storage) on the back end. Data persists, authentication is real, and access control is enforced in the database.

## Features

This is a *hybrid* DMS: it manages both uploaded document **files** and written **SOPs**, with full document-management machinery around them.

- **Real authentication** — email/password sign-in via Supabase Auth, with one-tap demo profiles.
- **Role-based access** — Administrator / Editor / Viewer, enforced by Postgres **Row Level Security** (not just the UI).
- **Document library** — sortable list with type, owner, last-updated, and view counts.
- **Folders** — hierarchical folder tree (with sub-folders) organised by procurement department.
- **Real file upload** — drag-and-drop or browse; files are stored in a private Supabase Storage bucket.
- **Version history** — every document tracks versions with author, date, and change notes; add versions in-app.
- **Sharing** — grant view access to specific colleagues; shares are stored and enforced server-side.
- **Audit trail** — an append-only activity log of uploads, edits, shares, and publishes.
- **Search & filters** — across titles, summaries, tags, owners, and SOP step text; filter by file type.
- **Draft / publish workflow** — drafts are visible only to editors/admins (enforced by RLS) until published.
- **Dashboard** — document counts, total views, most-accessed documents, breakdown by type, and the audit trail.

## Demo logins

All three accounts use the password **Demo1234!**

| Email                      | Role          | Can do                                              |
|----------------------------|---------------|-----------------------------------------------------|
| adunni@procuredesk.demo    | Administrator | Everything: upload, publish, version, share, delete  |
| tunde@procuredesk.demo     | Editor        | Upload, publish, version, share                      |
| folake@procuredesk.demo    | Viewer        | Browse/read published docs, view shares (no writes)  |

Sign in as Folake to confirm the draft document is hidden and the upload button is gone — that restriction is enforced by the database, not just the interface.

## How security works (worth understanding for the report)

Every table has **Row Level Security** enabled, so the database itself decides what each signed-in user can read and write:

- Viewers can read only **published** documents plus anything **shared** with them or that they **own**. Drafts are invisible to them.
- Only **editors/admins** can insert or update documents, folders, versions, and shares.
- Only **admins** can delete documents.
- The Storage bucket has matching policies: anyone signed in can read files, only editors/admins can upload.

This means the role checks in the React UI are a convenience, not the security boundary — even a tampered front end cannot bypass the rules, because they live in Postgres. This was verified by testing inserts as a viewer (blocked) and reads as each role.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173). The app connects to the hosted Supabase project out of the box.

To point it at your own Supabase project, copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (both safe to expose — RLS does the protecting).

## Build & deploy

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build
```

**Vercel:** push to a GitHub repo, import it at vercel.com (auto-detects Vite). Add the two VITE_SUPABASE_* environment variables in project settings, then deploy. Or run `npx vercel`.

**Netlify:** push to GitHub and import at netlify.com (build `npm run build`, publish `dist`), adding the same two environment variables. Or drag the built `dist/` folder into the dashboard.

`vercel.json` and `netlify.toml` are included for SPA routing.

## Backend schema

The Supabase database has six tables:

- **profiles** — one row per auth user; holds name, initials, role, department. Auto-created on signup by a trigger.
- **folders** — self-referencing hierarchy (parent_id), tagged by department.
- **documents** — the core object; files and SOPs. SOP steps are stored as JSON; files reference a storage path.
- **document_versions** — one row per version, with change note and author.
- **document_shares** — which profile a document is shared with.
- **audit_log** — append-only activity trail.

A `documents` storage bucket holds the actual uploaded files. Helper functions (my_role, is_editor) back the RLS policies; increment_views bumps view counts atomically.

## Project structure

```
dms-deploy/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── netlify.toml
├── .env.example       # Supabase URL + anon key
└── src/
    ├── main.jsx       # entry point
    ├── index.css      # global reset
    ├── supabase.js    # Supabase client
    ├── api.js         # data-access layer (all queries live here)
    ├── data.js        # UI constants + demo login credentials
    └── App.jsx        # the application
```

## Notes

- **Leaked-password protection** is an optional Supabase Auth setting (Dashboard → Authentication → Policies) worth enabling for a production deployment.
- The demo accounts use simple passwords on purpose; replace them before any real use.
