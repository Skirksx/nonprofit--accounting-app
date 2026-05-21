# Nonprofit Ledger MVP

A low-cost nonprofit accounting foundation built with TypeScript, Cloudflare Workers, and Cloudflare D1.

## What is included

- Login page with D1-backed sessions
- First-run organization setup page
- Dashboard page
- Chart of accounts page
- Server-side form validation
- Role-based access control primitives
- D1 database migration for organizations, users, members, sessions, and accounts
- Responsive HTML/CSS UI served by the Worker

## Architecture

The app runs as a single Cloudflare Worker. It renders server-side HTML, stores all application data in Cloudflare D1, and uses secure HTTP-only cookies for sessions.

Key files:

- `src/index.ts`: route table and page actions
- `src/auth.ts`: login, sessions, CSRF checks, and RBAC helpers
- `src/validation.ts`: server-side validation
- `src/views.ts`: server-rendered pages
- `src/styles.ts`: responsive UI styles
- `migrations/0001_initial_schema.sql`: initial D1 schema
- `wrangler.toml`: Cloudflare Worker and D1 configuration

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a local D1 database binding by keeping the `database_name` in `wrangler.toml` as `nonprofit_accounting`.

3. Apply migrations locally:

   ```sh
   npm run db:migrate:local
   ```

4. Start the local Worker:

   ```sh
   npm run dev
   ```

5. Open the local URL from Wrangler and visit `/setup` to create the first organization and owner account.

## Remote deployment

1. Create the production D1 database:

   ```sh
   npx wrangler d1 create nonprofit_accounting
   ```

2. Copy the returned database ID into `wrangler.toml`.

3. Apply migrations remotely:

   ```sh
   npm run db:migrate:remote
   ```

4. Deploy:

   ```sh
   npm run deploy
   ```

## Roles

The foundation includes four roles:

- `owner`: full organization control
- `admin`: administrative access
- `accountant`: can manage accounting records
- `viewer`: read-only access

The chart of accounts creation route currently requires at least `accountant`.

## Next build phases

1. Add funds, restrictions, and grant tracking.
2. Add journal entries with balanced debit/credit validation.
3. Add reporting views for statement of activity, financial position, and budget vs actuals.
4. Add user invitations and role management.
5. Add audit logs for financial changes.
