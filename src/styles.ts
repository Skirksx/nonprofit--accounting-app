export const styles = `
:root {
  color-scheme: light;
  --bg: #f6f7f4;
  --surface: #ffffff;
  --ink: #17211b;
  --muted: #647066;
  --line: #dfe4dc;
  --accent: #176b58;
  --accent-strong: #0d4f41;
  --warn: #a84624;
  --shadow: 0 14px 40px rgba(26, 38, 30, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--ink);
}

a {
  color: var(--accent-strong);
  font-weight: 650;
}

button,
.button-like {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  border: 0;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  background: var(--accent);
  color: white;
  font: inherit;
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
}

button:hover,
.button-like:hover {
  background: var(--accent-strong);
}

.danger-button {
  background: var(--warn);
}

.danger-button:hover {
  background: #7f321b;
}

.small-button {
  min-height: 2.1rem;
  padding: 0.45rem 0.65rem;
  font-size: 0.86rem;
  white-space: nowrap;
}

input,
select {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.7rem 0.8rem;
  color: var(--ink);
  background: white;
  font: inherit;
}

label {
  display: grid;
  gap: 0.4rem;
  color: #243229;
  font-weight: 700;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
}

th,
td {
  padding: 0.85rem;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

th {
  color: #39463e;
  font-size: 0.82rem;
  text-transform: uppercase;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--line);
  padding: 1rem clamp(1rem, 4vw, 3rem);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 5;
}

.brand {
  color: var(--ink);
  font-size: 1.05rem;
  font-weight: 850;
  text-decoration: none;
}

.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav a,
.link-button {
  color: var(--muted);
  background: transparent;
  min-height: auto;
  padding: 0;
  text-decoration: none;
  font-weight: 750;
}

.shell {
  width: min(1120px, calc(100vw - 2rem));
  margin: 0 auto;
  padding: clamp(1.5rem, 5vw, 4rem) 0;
}

.auth-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
  gap: clamp(1.5rem, 6vw, 5rem);
  align-items: center;
  min-height: calc(100vh - 7rem);
}

.page-heading {
  margin-bottom: 1.5rem;
}

.dashboard-heading {
  display: grid;
  justify-items: start;
}

.org-logo,
.logo-preview {
  display: block;
  width: min(180px, 45vw);
  max-height: 96px;
  object-fit: contain;
  margin-bottom: 1rem;
}

.logo-preview {
  width: min(220px, 100%);
  max-height: 120px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.75rem;
  background: #fbfcfa;
}

.eyebrow {
  margin: 0 0 0.5rem;
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 850;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  line-height: 1.1;
}

h1 {
  max-width: 780px;
  font-size: clamp(2rem, 5vw, 4rem);
}

h2 {
  font-size: 1.2rem;
}

.muted {
  max-width: 680px;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.6;
}

.form-card,
.grid-form,
.content-band,
.table-wrap {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.form-card,
.grid-form {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 3vw, 1.5rem);
}

.grid-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
}

.export-actions,
.employee-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.alert,
.field-error {
  color: var(--warn);
}

.alert {
  margin: 0;
  font-weight: 750;
}

.field-error {
  font-size: 0.86rem;
  font-weight: 650;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.metric {
  display: grid;
  gap: 0.5rem;
  border-top: 4px solid var(--accent);
  border-radius: 8px;
  padding: 1rem;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.metric span {
  color: var(--muted);
  font-weight: 750;
}

.metric strong {
  font-size: 2rem;
}

.content-band {
  padding: 1.25rem;
}

.task-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.task-list span,
.task-list a {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.8rem;
  background: #fbfcfa;
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
}

.task-list a:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.line-set {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 1rem;
}

.line-set legend {
  padding: 0 0.35rem;
  color: var(--accent-strong);
  font-weight: 850;
}

.split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  align-items: start;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.check-row input {
  width: auto;
  min-height: auto;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}

.table-wrap {
  overflow-x: auto;
}

.empty {
  color: var(--muted);
  text-align: center;
}

.report-filter {
  margin-bottom: 1.5rem;
}

.report-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.report-nav a {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.65rem 0.8rem;
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
}

.report-nav a:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.report-section {
  display: grid;
  gap: 1rem;
}

.budget-editor input,
.budget-editor select {
  min-width: 9rem;
}

.table-edit-form,
.budget-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.employee-editor {
  border-top: 1px solid var(--line);
  padding-top: 1rem;
}

.employee-editor summary {
  color: var(--accent-strong);
  cursor: pointer;
  font-weight: 850;
}

.employee-edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.employee-edit-card {
  display: grid;
  gap: 0.85rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 1rem;
  background: #fbfcfa;
}

.employee-edit-card h3 {
  margin: 0;
  font-size: 1rem;
}

.report-table {
  box-shadow: none;
}

.amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.report-total,
.report-net {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid var(--line);
  padding-top: 0.85rem;
  font-weight: 850;
}

.report-net {
  border-top: 3px solid var(--accent);
  font-size: 1.1rem;
}

@media (max-width: 760px) {
  .topbar,
  .nav,
  .form-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .auth-panel,
  .grid-form,
  .metric-grid,
  .task-list,
  .line-set,
  .settings-grid,
  .split,
  .employee-edit-grid {
    grid-template-columns: 1fr;
  }
}
`;
