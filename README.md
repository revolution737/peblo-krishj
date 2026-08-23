# Peblo TV Mini

> **Take-Home Challenge — Full-Stack Platform Engineer (Python/FastAPI + React)**  
> CMS upload → PostgreSQL → Atomic Publish Job → Storage (`catalogue.json`) → Netflix-Style Viewer UI.

---

## 1. System Architecture & Flow

```text
┌──────────────────────────┐
│   Internal CMS (React)   │ ──► Upload Artworks / Edit Metadata / Audit Catalog
└─────────────┬────────────┘
              │ (JWT Bearer: Editor or Admin)
              ▼
┌──────────────────────────┐
│   FastAPI Backend (API)  │ ──► PostgreSQL (Shows, Seasons, Episodes, Artworks, Users, PublishRuns)
└─────────────┬────────────┘
              │ (POST /admin/catalog/publish [Admin only])
              ▼
┌──────────────────────────┐
│    Atomic Publish Job    │ ──► Language Collapsing + Validation + Atomic Write to Storage
└─────────────┬────────────┘
              │
              ▼
┌──────────────────────────┐
│  catalogue.json (Storage)│
└─────────────┬────────────┘
              │
              ▼
┌──────────────────────────┐
│   Viewer UI (React/TS)   │ ──► Reads GET /catalog & GET /catalog/search (Netflix Browse)
└──────────────────────────┘
```

---

## 2. Strict Domain Rules & Implementation Details

| # | Domain Rule | Implementation Strategy |
|---|---|---|
| 1 | **Season 0 Exclusion** | `season_number == 0` is reserved exclusively for trailers. Filtered out from all viewer season lists (`.filter(s => s.season_number !== 0)`). |
| 2 | **Content Group Collapsing** | Language variants share a `content_group` and are stored as distinct rows with unique constraint `(content_group, language)`. The publish job collapses them into a single entry with a `languages: string[]` array. |
| 3 | **Seed Data Validation** | Seed data anomalies (unassigned sections, missing artwork, casing inconsistencies, duplicate groups) are caught and surfaced via `GET /admin/validation-report`. |
| 4 | **Server-Side Artwork Validation** | `POST /admin/artwork/upload` uses Pillow to strictly enforce: **Poster** (2:3, ~600x900), **Banner** (16:9, ~1280x720), **Thumbnail** (16:9, ~640x360), Max **200 KB**. |
| 5 | **Atomic Publish Job** | Writes JSON to a temporary file (`catalogue.json.tmp.<uuid>`), syncs to disk, and replaces live file via `os.replace()`. Completely atomic and idempotent. |
| 6 | **Role-Based Access Control** | Enforced at route level with JWT dependencies (`require_editor` for CRUD/Audit, `require_admin` for `/admin/catalog/publish`). |
| 7 | **CMS & Viewer Separation** | Viewer client interacts solely with read-only endpoints (`/catalog` and `/catalog/search`) without admin privileges or tokens. |
| 8 | **Server-Side Search** | Search endpoint (`GET /catalog/search?q=...&language=...&category=...&section=...`) performs server-side filtering on the published catalog snapshot. |
| 9 | **Viewer UI Styling (mypeblo.com Design)** | Viewer UI follows a Light mode theme utilizing the brand colors (Orange, Purple, Yellow) and typography ("Grandstander" & "Poppins") from mypeblo.com, while preserving Netflix-style horizontal row browsing and modal logic. |

---

## 3. Seed Data Integrity Issues Surfaced

The `GET /admin/validation-report` endpoint audits and surfaces deliberate data issues present in `seed_shows.json`:

1. **Duplicate Content Group + Language:** `ep_9001` duplicates `ep_0004` (`motis-many-lives-s01e02`, Hindi). The seed script enforces unique constraints and skips duplicate ingestion.
2. **Missing Section:** Shows such as *Rhyme Rangers* have `section: null`. Flagged as blocking issue since published shows require a valid section (`featured`, `series`, `minisodes`, `songs`).
3. **Missing Artwork:** Episodes with empty artwork arrays are identified as blocking issues before publishing.
4. **Draft Episodes:** Filtered out from live published outputs.
5. **Inconsistent Title Casing:** Detected (e.g. ALL-CAPS titles) and reported under non-blocking data quality warnings.

---

## 4. Quick Start & How to Run

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ & npm

### Step 1: Start PostgreSQL & FastAPI Backend
```bash
docker compose up -d --build
```
- API Docs (Swagger): **http://localhost:8000/docs**
- Health Check: **http://localhost:8000/health**

### Step 2: Seed Default Credentials
The database automatically seeds on startup:
- **Admin**: `admin@peblo.tv` / `admin123` (Full CRUD + Publish permission)
- **Editor**: `editor@peblo.tv` / `editor123` (CRUD & Validation Audit)

### Step 3: Run the CMS Frontend
```bash
npm run dev:cms
# or: cd cms && npm run dev -- --port 5173
```
- CMS URL: **http://localhost:5173**

### Step 4: Run the Viewer UI
```bash
npm run dev:viewer
# or: cd viewer && npm run dev -- --port 5174
```
- Viewer URL: **http://localhost:5174**

---

## 5. Architectural Trade-offs & Production Considerations

### Search & Scale Trade-offs
- **Current Approach:** `GET /catalog/search` loads the active `catalogue.json` snapshot from local storage and executes memory-efficient multi-field filtering.
- **Production Scale Plan:** For catalogs exceeding 50,000+ titles, the search should be offloaded to **PostgreSQL Full-Text Search with `pg_trgm` indexes** or dedicated **Elasticsearch / Meilisearch / Typesense** clusters with edge CDN caching (Cloudflare KV / Workers) for sub-10ms global response times.

### Storage Abstraction
- The `StorageBackend` abstract base class decouples file operations. The current implementation uses `LocalStorageBackend`. Swapping to **Cloudflare R2** or **AWS S3** requires only setting `STORAGE_BACKEND=s3` and providing bucket credentials without modifying any router logic.

---

## 6. Time Spent Breakdown

- **Backend Scaffolding & DB Models:** ~1.5 hours
- **Storage Abstraction & Pillow Artwork Validation:** ~1 hour
- **JWT Auth & Role-Based Access Control:** ~45 mins
- **Atomic Publish Job & Content Group Collapsing:** ~1.5 hours
- **CMS Frontend (React + TS + Vanilla CSS):** ~2 hours
- **Netflix-Style Viewer UI with mypeblo.com Branding (React + TS):** ~2 hours
- **Testing, CI Pipeline & Documentation:** ~45 mins
