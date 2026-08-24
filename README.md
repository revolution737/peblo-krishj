# Peblo TV Mini 📺

> **Take-Home Challenge — Full-Stack Platform Engineer**  
> A miniature end-to-end streaming platform consisting of a React CMS, a Python/FastAPI backend, an atomic publishing pipeline, and a React-based Netflix-style Viewer UI.

---

## 🚀 1. How to Run It

The system is designed to be brought up quickly using Docker Compose. The compose file provisions the PostgreSQL database, runs migrations, seeds the data, and boots the backend API alongside multi-stage Nginx containers for the frontends.

### Prerequisites
- Docker & Docker Compose (`docker compose`)
- Node.js 18+ & npm (Optional, for local development outside Docker)

### Step 1: Start the Entire Platform
```bash
# This brings up the Postgres DB, FastAPI backend, and runs the seed script automatically.
# It also builds and serves the CMS and Viewer UIs via multi-stage Nginx containers.
docker compose up -d --build
```
- **API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **CMS URL:** [http://localhost:3000](http://localhost:3000)
- **Viewer URL:** [http://localhost:3001](http://localhost:3001)

*Note: The database seeds automatically with two default users:*
- **Admin**: `admin@peblo.tv` / `admin123` (Full CMS CRUD + Publish/Rollback rights)
- **Editor**: `editor@peblo.tv` / `editor123` (CMS CRUD only)

---

## 2. Decisions, Trade-offs, and Part E Questions

### Part A: Database & Seeding Strategy
**Decision:** I used PostgreSQL with SQLAlchemy async sessions. The seed script runs automatically on boot and handles the "imperfect" seed data gracefully.
**Trade-offs:** I enforced a strict `UNIQUE(content_group, language)` constraint in the schema. In `asyncio` SQLAlchemy, catching a database `IntegrityError` poisons the entire transaction, requiring complex nested savepoints to recover. To gracefully handle duplicate language variants in the seed data (e.g., the duplicate Hindi entry for `ep_9001`) without aborting the transaction, the seed script performs an in-memory deduplication check (`seen_content_keys`) before inserting rows. This guarantees database integrity while keeping the seed script robust.

### Part B: API & CMS Implementation
**Decision:** Built a robust FastAPI backend and a React/Vite CMS with strict Role-Based Access Control (RBAC). The CMS includes a "Validation Report" endpoint to explicitly check for missing data (like missing artwork or missing show sections) before an Admin is permitted to publish. I used `@tanstack/react-query` in the CMS for robust data fetching and state synchronization.
**Trade-offs:** 
- **Secrets Management:** JWT secrets and database passwords are hardcoded in the `docker-compose.yml` and `.env` files strictly for local evaluation purposes. In a real environment, these would be injected via a secrets manager like HashiCorp Vault or AWS Secrets Manager.

### Part C: The Atomic Publish Pipeline
**How publishing is made atomic (and handling mid-publish failures)**
To ensure viewers never see a corrupted or half-written catalogue, the publishing job writes the generated JSON to a unique temporary file on disk (`catalogue_{run_id}.json.tmp`). Once the entire write operation completes, it is copied for historical backup, and finally, we perform an atomic POSIX filesystem operation (`os.replace`) to swap the temporary file over the live `catalogue.json`. 
**If the process dies mid-publish:** The temporary file is simply abandoned. The live `catalogue.json` remains completely untouched, meaning viewers experience zero downtime.

**Storage Abstraction (Moving to Cloudflare R2)**
I implemented a `StorageBackend` abstract base class to decouple file I/O operations from the business logic. Currently, it uses a `LocalStorageBackend`. To migrate to Cloudflare R2 (which provides an S3-compatible API), the only necessary change is creating an `S3StorageBackend` class that implements `save()`, `get()`, and `delete()` using the `boto3` library. The system can then inject this new class at runtime when a `STORAGE_BACKEND=s3` environment variable is detected, requiring zero changes to route handlers or the publish pipeline.

### Part D: Viewer UI & Search
**Decision:** A Netflix-style, high-performance UI reading public catalogue endpoints.
**Trade-offs:** 
- **Dockerization:** For both the Viewer and CMS, I implemented multi-stage Docker builds using `nginx:alpine` to serve production-ready static assets built by Vite, giving a highly accurate representation of a production deployment.
- **State Management:** I skipped using TanStack Query in the Viewer UI for simplicity, relying on standard React `useEffect` hooks instead since the surface area is primarily read-only.
- **Pagination:** The Viewer UI currently lacks pagination or infinite scroll, relying purely on basic category/language filters. This is a known limitation that would need addressing before scaling the UI.

**How did you implement search and what are its scale limits?**
Search is implemented via a public `GET /catalog/search` backend endpoint, which performs an **in-memory filter** over the cached `catalogue.json` file. 
*Limitations:* This approach allows us to avoid doing full-catalogue searches on low-end client devices (which could cause heap bloat or battery drain on mobile). It easily handles catalogues of a few thousand items locally due to fast Python dictionary traversals. However, as the catalogue scales toward **10,000 to 50,000+ titles**, keeping massive JSON trees in memory on the backend and parsing them per request will degrade performance and spike memory usage. At that scale, search must be offloaded to a dedicated search engine (like Typesense, Algolia, or Elasticsearch).

**Pre-published Catalogue vs. Database Queries Per Request**
*Why pre-publish?* The Viewer UI traffic pattern is heavily read-oriented and experiences massive spikes. Serving a static `catalogue.json` drastically reduces database load. A static file can be served via a CDN directly from the edge, achieving near-infinite scalability and sub-10ms response times with zero database queries.
*Where it bites us:* It creates an eventual consistency hurdle. Editors must explicitly remember to hit "Publish", and there is a natural delay between saving a change in the CMS and a user seeing it on their TV.

### Deployment Strategy
For a real production environment, the `deploy` step in our CI/CD pipeline would trigger after successful checks. It would:
1. Build the multi-stage Docker images for the API, CMS, and Viewer.
2. Tag the images with the Git commit SHA.
3. Push them to a container registry (e.g., AWS ECR).
4. Update container orchestration (e.g., ECS Task Definitions) to point to the new images and force a rolling deployment.
5. Apply database migrations via a standalone migration task before routing traffic to new API instances.

### Alerting Strategy
**Metric:** Alert on a spike in 5xx HTTP errors from the backend API.
**Reasoning:** If the backend starts throwing 5xx errors, it indicates a critical failure such as database connection loss, disk full (storage abstraction failure), or unhandled exceptions in the publish job. This directly impacts the core capability of the editors to publish content and needs immediate engineering attention.

### Part E: Optional Stretch Goals 
**What was left out and why?**
While I implemented the core requirements, I skipped TanStack Query/pagination in the Viewer UI to focus my time on the backend pipeline, robust CMS features, and atomic publishing logic.

I successfully implemented both optional stretch goals to make the platform highly robust:
1. **Versioned Catalogue & Rollbacks:** The system retains historical copies of `catalogue_{run_id}.json`. The CMS Dashboard provides a "Publish History" view, allowing Admins to instantaneously roll back the Viewer UI to any previous publish state via an atomic `os.replace` operation.
2. **Audit Logs:** All mutating actions (Creates, Updates, Deletes, Uploads, Publishes, and Rollbacks) are logged to a dedicated `AuditLog` table using a `log_audit_event` backend helper. This is queryable via a real-time Audit Logs dashboard in the CMS.

---

## ⏱ 3. Time Spent Breakdown

- **Part A: Backend Scaffolding, DB Models, & Seeding:** 1 hour
- **Part B: CMS API, Auth, Image Validation, & React Frontend:** 2 hours
- **Part C: Atomic Publish Job & Storage Abstraction:** 1 hour
- **Part D: Viewer UI (Netflix Style Frontend):** 45 minutes
- **Part E: CI/CD, Documentation & Trade-off Analysis:** 30 minutes
- **Optional Stretch Goals (Rollback & Audit Logs):** 1 hour
