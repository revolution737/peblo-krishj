# Peblo TV Mini 📺

> **Take-Home Challenge — Full-Stack Platform Engineer**  
> A miniature end-to-end streaming platform consisting of a React CMS, a Python/FastAPI backend, an atomic publishing pipeline, and a React-based Netflix-style Viewer UI.

---

## 🚀 1. How to Run It

The system is designed to be brought up quickly using Docker Compose. The compose file provisions the PostgreSQL database, runs migrations, seeds the imperfect data, and boots the backend API.

### Prerequisites
- Docker & Docker Compose (`docker compose`)
- Node.js 18+ & npm

### Step 1: Start the Backend Pipeline
```bash
# This brings up the Postgres DB, FastAPI backend, and runs the seed script automatically.
docker compose up -d --build
```
- **API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

*Note: The database seeds automatically with two default users:*
- **Admin**: `admin@peblo.tv` / `admin123` (Full CMS CRUD + Publish/Rollback rights)
- **Editor**: `editor@peblo.tv` / `editor123` (CMS CRUD only)

### Step 2: Start the CMS Frontend
```bash
cd cms
npm ci
npm run dev
```
- **CMS URL:** [http://localhost:5173](http://localhost:5173)

### Step 3: Start the Viewer UI
```bash
cd viewer
npm ci
npm run dev
```
- **Viewer URL:** [http://localhost:5174](http://localhost:5174)

---

## 2. Decisions, Trade-offs, and Part E Questions

### Part A: Database & Seeding Strategy
**Decision:** I used PostgreSQL with SQLAlchemy async sessions. The seed script runs automatically on boot and handles the "imperfect" seed data gracefully.
**Trade-offs:** I enforced a `UNIQUE(content_group, language)` constraint. This meant the duplicate Hindi language group in the seed data (`ep_9001`) throws an IntegrityError, which the script catches and skips. This ensures strict database integrity at the cost of dropping bad seed data.

### Part B: API & CMS Implementation
**Decision:** Built a robust FastAPI backend and a React/Vite CMS with Role-Based Access Control (RBAC). I integrated inline-editing for titles and collapsible accordions for episodes/artwork to maximize editor efficiency and to demonstrate rollback testing. I also added a "Validation Report" endpoint to explicitly check for missing data (like artwork or missing sections) before allowing an Admin to publish.

### Part C: The Atomic Publish Pipeline
**How publishing is made atomic (and handling mid-publish failures)**
To ensure viewers never read a half-written catalogue, the publishing job writes the generated JSON to a unique temporary file on disk (e.g., `catalogue_{run_id}.json.tmp`). Once the entire write operation completes and is flushed to the OS, we copy it to a historical backup and then perform an atomic filesystem operation (`os.replace` in Python) to swap the temporary file over the live `catalogue.json`.
**If the process dies mid-publish:** The temporary file is simply abandoned. The live `catalogue.json` remains completely untouched, meaning viewers experience zero downtime or corrupted data.

**Storage Abstraction (Moving to Cloudflare R2)**
I implemented a `StorageBackend` abstract base class to decouple file I/O operations from the business logic. Currently, it uses a `LocalStorageBackend`. 
To migrate to Cloudflare R2 (which provides an S3-compatible API), the only necessary change is creating an `S3StorageBackend` class that implements `save_file(path, bytes)` and `get_file(path)` using the `boto3` library. The system can then inject this new class at runtime when a `STORAGE_BACKEND=s3` environment variable is detected. No route handlers or publish jobs would need to change.

### Part D: Viewer UI & Search
**Decision:** A Netflix-style, high-performance UI reading exclusively from the static `catalogue.json`.
**How did you implement search and what are its scale limits?**
Search is implemented directly in the React frontend (and a separate backend filter for the CMS). The frontend filters the `catalogue.json` payload in memory across `title`, `categories`, and `language`. 
*Limitations:* This works flawlessly for small-to-medium catalogues (e.g., ~1,000 titles) because JSON parsing in modern browsers is incredibly fast. However, at around **10,000 to 50,000+ titles**, parsing large JSON payloads into memory will cause significant heap bloat and lag on low-end mobile devices. At that scale, search must be offloaded to a dedicated edge-cached backend search engine (like Typesense or Elasticsearch).

**Pre-published Catalogue vs. Database Queries Per Request**
*Why pre-publish?* The Viewer UI traffic pattern is heavily read-oriented and experiences massive spikes. Serving a static `catalogue.json` drastically reduces database load. A static file can be served via a CDN directly from the edge, achieving near-infinite scalability and sub-10ms response times with zero database queries.
*Where it bites us:* It creates an eventual consistency hurdle. Editors must explicitly remember to hit "Publish", and there is a natural delay between saving a change in the CMS and a user seeing it on their TV.

### Part E: Optional Stretch Goals & AI Usage
**What was left out and why? AI usage?**
Nothing was left out! I successfully implemented both optional stretch goals to make the platform highly robust:
1. **Versioned Catalogue & Rollbacks:** The system retains historical copies of `catalogue_{run_id}.json`. The CMS Dashboard provides a "Publish History" view, allowing Admins to instantaneously roll back the Viewer UI to any previous publish state via an atomic `os.replace` operation.
2. **Audit Logs:** All mutating actions (Creates, Updates, Deletes, Uploads, Publishes, and Rollbacks) are logged to a dedicated `AuditLog` table using a `log_audit_event` backend helper. This is queryable via a real-time Audit Logs dashboard in the CMS.

**AI Usage:** I used Antigravity for coding, architecture planning, and feature execution. While the core foundation was built rapidly, I took a highly iterative approach for the CMS and Viewer UI to ensure premium, Netflix-like usability. Furthermore, I employed a careful verification strategy when implementing the atomic rollback mechanism to ensure 100% zero-downtime file swaps without losing historical data backups on disk. However I was vigilant throughout and used the AI tool cautiously and make manual refactors to correct its mistakes constantly.

---

## ⏱ 3. Time Spent Breakdown

- **Part A: Backend Scaffolding, DB Models, & Seeding:** 1 hour
- **Part B: CMS API, Auth, Image Validation, & React Frontend:** 2 hours
- **Part C: Atomic Publish Job & Storage Abstraction:** 1 hour
- **Part D: Viewer UI (Netflix Style Frontend):** 45 minutes
- **Part E: CI/CD, Documentation & Trade-off Analysis:** 30 minutes
- **Optional Stretch Goals (Rollback & Audit Logs):** 1 hour
