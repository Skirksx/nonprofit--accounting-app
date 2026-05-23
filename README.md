# Nonprofit Ledger MVP

A low-cost nonprofit accounting foundation built with TypeScript, Cloudflare Workers, and Cloudflare D1.

## What is included

- Login page with D1-backed sessions
- First-run organization setup page
- Dashboard page
- Chart of accounts page
- Chart of accounts module with account number, account name, account type, normal balance, status, and organization ID
- Journal entry system with headers, multiple lines, draft/post status, and debit/credit balancing before posting
- Simple income and expense transaction entry screen backed by the journal entry system
- Statement of Activities report from posted journal lines with date range and fund filters
- Settings page for profile name, password changes, and dashboard logo upload
- Payroll entry, pay statement PDFs, tax report PDFs, CSV export, and CSV payroll import
- Server-side form validation
- Role-based access control primitives
- D1 database migration for organizations, users, members, sessions, and accounts
- Responsive HTML/CSS UI served by the Worker

## Architecture

The app runs as a single Cloudflare Worker. It renders server-side HTML, stores all application data in Cloudflare D1, and uses secure HTTP-only cookies for sessions.

Key files:

- `src/index.ts`: route table and page actions
- `src/auth.ts`: login, sessions, CSRF checks, and RBAC helpers
- `src/accounts.ts`: chart of accounts queries and commands
- `src/journalEntries.ts`: journal entry validation, draft creation, and posting rules
- `src/transactions.ts`: simple income/expense entry workflow that creates and posts journal entries
- `src/reports.ts`: reporting queries for funds and Statement of Activities
- `src/payroll.ts`: payroll calculations, journal entry creation, PDFs, CSV export, and CSV import validation
- `src/settings.ts`: profile, password, and logo upload helpers
- `src/database.ts`: PostgreSQL connection helper for a Render/Neon Node.js deployment using `DATABASE_URL`
- `src/validation.ts`: server-side validation
- `src/views.ts`: server-rendered pages
- `src/styles.ts`: responsive UI styles
- `migrations/0001_initial_schema.sql`: initial D1 schema
- `migrations/0002_chart_of_accounts_module.sql`: explicit chart of accounts schema upgrade
- `migrations/0003_journal_entries.sql`: journal entry headers and lines
- `migrations/0004_funds_and_statement_activity_support.sql`: funds and journal-line fund filtering support
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

6. Run tests:

   ```sh
   npm test
   ```

## Environment variables for Render and Neon

For a Render deployment with Neon PostgreSQL, do not hardcode the database password or connection string. Set it as an environment variable named `DATABASE_URL`.

1. Copy the sample local environment file:

   ```sh
   cp .env.example .env
   ```

2. Put your Neon connection string in `.env`:

   ```env
   DATABASE_URL=postgresql://username:password@ep-example.neon.tech/neondb?sslmode=require
   ```

3. In Render, add the same environment variable under your service settings:

   ```text
   DATABASE_URL = your Neon PostgreSQL connection string
   ```

4. Use the PostgreSQL helper from `src/database.ts` in Node.js server code:

   ```ts
   import { query } from "./database.ts";

   const result = await query("SELECT NOW()");
   console.log(result.rows);
   ```

The real `.env` file is ignored by Git so credentials do not get uploaded to GitHub.

## Payroll CSV import

On the Payroll page, download the import template first. Fill in one row per paycheck and upload the CSV from the same page. The required columns are:

```csv
employee_code,pay_date,period_start,period_end,pay_frequency,hours_worked,bonus_taxable,override_403b
EMP001,2026-05-31,2026-05-16,2026-05-31,semimonthly,80.00,0.00,
```

The upload still uses the payroll journal entry system. Each imported row must balance before it is posted.

## Render port configuration

Render provides the public web port through `process.env.PORT`. The Node server entry in `src/server.ts` uses that value automatically and falls back to port `3000` for local development.

```ts
const port = Number(process.env.PORT) || 3000;

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

For Render, use these commands:

Build Command:

```sh
yarn install --production=false
```

Start Command:

```sh
yarn start
```

For local Render-style testing, run:

```sh
yarn start
```

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
