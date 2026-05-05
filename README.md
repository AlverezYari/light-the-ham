# Light the Ham!

A community-driven guide to Christmas light displays in the Greater Birmingham Metro Area.

## Features

- **Interactive Map** - Browse light displays on a Leaflet-powered map with clustering
- **Ratings** - Rate displays with a 1-5 torch scale
- **Photo Uploads** - Contribute photos of displays
- **Visitor Tips** - Share parking tips, best viewing times, etc.
- **Tours** - Create and share custom driving tours of displays
- **Property Ownership** - Claim your property to manage its listing
- **Moderation** - Admin panel for approving community contributions
- **OAuth Authentication** - Sign in with Google

## Tech Stack

- **Framework**: [Astro](https://astro.build) with SSR via `@astrojs/node`
- **Database**: SQLite via [Drizzle ORM](https://orm.drizzle.team) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4
- **Maps**: [Leaflet](https://leafletjs.com) with marker clustering
- **Geocoding**: Google Maps Geocoding API
- **Auth**: [Arctic](https://arcticjs.dev) OAuth library

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- [Task](https://taskfile.dev) (optional but recommended)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Set up database (creates tables)
pnpm db:push

# Seed sample data (optional, for development)
pnpm db:seed

# Start development server
pnpm dev
```

Visit `http://localhost:4321`

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Required for OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Required for address geocoding
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Required for production
SITE_URL=https://your-domain.com
```

See `.env.example` for all available options.

### Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:4321/api/auth/google/callback`
4. Copy Client ID and Secret to `.env`

### Setting Up Google Maps Geocoding

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com)
2. Enable the Geocoding API
3. Create an API key and add to `.env`
4. (Optional) Restrict key to Geocoding API only

## Scripts

Using [Task](https://taskfile.dev) (recommended):

```bash
task dev          # Start development server
task dev:host     # Start dev exposed to network (mobile testing)
task build        # Build for production
task preview      # Preview production build

task db:push      # Push schema to database
task db:studio    # Open Drizzle Studio (DB browser)
task db:seed      # Seed sample data

task admin -- user@example.com   # Make a user an admin
```

Or with pnpm directly:

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build

pnpm db:push      # Push schema to database
pnpm db:studio    # Open Drizzle Studio (DB browser)
pnpm db:seed      # Seed sample data

npx tsx scripts/make-admins.ts user@example.com
```

## Docker

```bash
task docker:build    # Build image
task docker:run      # Run locally with volumes
task docker:push     # Push to registry
task release         # Typecheck, build, and push

# Override registry:
task docker:push REGISTRY=your-registry.example.com
```

The Docker image auto-runs database migrations on startup.

## Project Structure

```
src/
├── components/     # Reusable Astro components
├── layouts/        # Page layouts
├── lib/
│   ├── auth.ts     # OAuth & session management
│   ├── geocode.ts  # Google Maps geocoding
│   └── db/         # Database schema & connection
├── pages/
│   ├── api/        # API routes
│   │   ├── admin/  # Moderation endpoints
│   │   ├── auth/   # OAuth endpoints
│   │   ├── claims/ # Property claims
│   │   └── tours/  # Tour management
│   ├── admin/      # Admin panel
│   ├── properties/ # Property detail pages
│   ├── tours/      # Tour pages
│   └── ...         # Other pages
└── styles/         # Global styles

scripts/            # Utility scripts (seed, make-admins, etc.)
data/               # SQLite database (gitignored)
public/uploads/     # User uploads (gitignored)
```

## Key Features

### Tours
Users can create custom driving tours by selecting properties from the map. Tours get a shareable URL. Admins can feature tours to display on the public tours page.

### Property Ownership
- Users can claim ownership when submitting a property (requires login)
- Users can adopt unclaimed properties from the property detail page
- Disputed claims go to admin queue for manual resolution
- Limits: 3 properties per user, 24hr cooldown between claims

### Moderation
Admin panel at `/admin` for:
- Approving/rejecting photos, tips, and properties
- Managing tours (feature/delete)
- Resolving ownership disputes

## Deployment

### Requirements

- Node.js 20+ runtime
- Persistent storage for:
  - `./data/` - SQLite database
  - `./public/uploads/` - User-uploaded photos
- Environment variables configured

### Build & Run

```bash
pnpm build
node ./dist/server/entry.mjs
```

Default port: `4321` (configurable via `PORT` env var)

### Database Migrations

Migrations run automatically via `docker-entrypoint.sh` or manually:

```bash
task db:push
```

### Database Replication

For production, we recommend [Litestream](https://litestream.io) for SQLite replication to S3-compatible storage.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

## License

MIT

---

Built with love in Birmingham, Alabama.
