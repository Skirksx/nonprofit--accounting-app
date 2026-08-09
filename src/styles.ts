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
  --rotary-blue: #17458f;
  --rotary-gold: #f7a81b;
  --warn: #a84624;
  --shadow: 0 16px 42px rgba(26, 38, 30, 0.09);
  --soft-shadow: 0 8px 24px rgba(26, 38, 30, 0.07);
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
select,
textarea {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.7rem 0.8rem;
  color: var(--ink);
  background: white;
  font: inherit;
}

textarea {
  resize: vertical;
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
  padding: 0.85rem clamp(1rem, 4vw, 3rem);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 5;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  color: var(--ink);
  font-size: 1.05rem;
  font-weight: 850;
  text-decoration: none;
}

.brand span {
  display: grid;
  gap: 0.1rem;
}

.brand strong {
  line-height: 1.05;
}

.brand-org {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 750;
}

.brand-logo {
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid rgba(23, 69, 143, 0.18);
  border-radius: 50%;
  padding: 0.22rem;
  background: #fff;
  object-fit: contain;
  box-shadow: var(--soft-shadow);
}

.nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.9rem 1rem;
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
  border-bottom: 1px solid rgba(23, 107, 88, 0.12);
  padding-bottom: 1.1rem;
}

.dashboard-heading {
  display: grid;
  justify-items: start;
  align-items: center;
}

.branded-heading {
  grid-template-columns: auto minmax(0, 1fr);
  gap: clamp(1rem, 3vw, 1.75rem);
  border: 1px solid rgba(23, 69, 143, 0.14);
  border-left: 6px solid var(--rotary-blue);
  border-radius: 8px;
  padding: clamp(1rem, 3vw, 1.5rem);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfa 100%);
  box-shadow: var(--soft-shadow);
}

.org-logo,
.logo-preview {
  display: block;
  width: min(132px, 35vw);
  max-height: 112px;
  object-fit: contain;
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
  color: var(--rotary-blue);
  font-size: 0.8rem;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0;
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
  border-top: 4px solid var(--rotary-gold);
  border-radius: 8px;
  padding: 1rem;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.metric-card {
  display: grid;
  gap: 0.45rem;
  border: 1px solid var(--line);
  border-top: 4px solid var(--rotary-gold);
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
  box-shadow: var(--soft-shadow);
}

.metric-card span {
  color: var(--muted);
  font-weight: 750;
}

.metric-card strong {
  font-size: clamp(1.25rem, 2vw, 1.8rem);
  line-height: 1.15;
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
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.65rem;
  margin-bottom: 1.5rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--soft-shadow);
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
  border-color: var(--rotary-blue);
  color: var(--rotary-blue);
  background: #f7faff;
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

.dues-toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(620px, 1.35fr);
  gap: 1rem;
  align-items: end;
  margin-bottom: 1rem;
}

.dues-settings-form {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr 1fr auto;
  gap: 0.75rem;
  align-items: end;
}

.dues-settings-form label {
  gap: 0.25rem;
  font-size: 0.86rem;
}

.dues-settings-form input,
.dues-settings-form select {
  min-height: 2.4rem;
}

.dues-sheet {
  width: min(1760px, calc(100vw - 2rem));
  margin-left: 50%;
  transform: translateX(-50%);
  box-shadow: var(--shadow);
  border-color: #c7cec7;
  background: #fff;
}

.dues-sheet table {
  min-width: 1660px;
  table-layout: fixed;
  font-size: 0.9rem;
}

.dues-sheet th {
  border: 1px solid #b8c0b9;
  background: #d7d9d6;
  color: #101512;
  font-size: 0.9rem;
  text-align: center;
  text-transform: none;
}

.dues-sheet td {
  border: 1px solid #c8d0c9;
  padding: 0.35rem;
  background: #fbfbfa;
  vertical-align: middle;
}

.dues-sheet th:nth-child(1),
.dues-sheet td:nth-child(1) {
  width: 190px;
}

.dues-sheet th:nth-child(2),
.dues-sheet td:nth-child(2) {
  width: 315px;
}

.dues-sheet th:nth-child(3),
.dues-sheet td:nth-child(3) {
  width: 250px;
}

.dues-sheet th:nth-child(4),
.dues-sheet td:nth-child(4),
.dues-sheet th:nth-child(5),
.dues-sheet td:nth-child(5) {
  width: 150px;
}

.dues-sheet th:nth-child(6),
.dues-sheet td:nth-child(6),
.dues-sheet th:nth-child(7),
.dues-sheet td:nth-child(7),
.dues-sheet th:nth-child(8),
.dues-sheet td:nth-child(8),
.dues-sheet th:nth-child(9),
.dues-sheet td:nth-child(9) {
  width: 88px;
}

.dues-sheet th:nth-child(10),
.dues-sheet td:nth-child(10) {
  width: 360px;
}

.dues-sheet th:nth-child(11),
.dues-sheet td:nth-child(11) {
  width: 92px;
}

.dues-sheet input,
.dues-sheet select,
.dues-sheet textarea {
  min-height: 2rem;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 0.35rem 0.45rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: none;
  font-size: 0.88rem;
}

.dues-member-name {
  font-weight: 800;
  line-height: 1.25;
}

.dues-member-name a {
  color: #111815;
}

.dues-email-input {
  min-width: 100%;
  font-size: 0.86rem !important;
}

.dues-pill {
  min-height: 1.7rem;
  border-radius: 999px;
  text-align: center;
  font-weight: 750;
}

.dues-pill-frequency {
  background: #ffe69a !important;
  color: #5d4800;
}

.dues-pill-included {
  background: #e7c4f3 !important;
  color: #67307d;
}

.dues-pill-included option[value="dues_and_meals"] {
  color: #894314;
}

.dues-check {
  text-align: center;
}

.dues-check input {
  width: 1.2rem;
  min-height: 1.2rem;
  accent-color: #111815;
}

.dues-save {
  text-align: center;
}

.dues-save .small-button {
  width: 100%;
  min-width: 4.6rem;
  padding-inline: 0.45rem;
}

.detail-list {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.65rem 1rem;
}

.detail-list dt {
  color: var(--muted);
  font-weight: 800;
}

.detail-list dd {
  margin: 0;
}

.dues-actions {
  justify-content: flex-start;
  margin-top: 1rem;
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

  .brand {
    align-self: flex-start;
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

  .branded-heading {
    grid-template-columns: 1fr;
  }
}
`;
