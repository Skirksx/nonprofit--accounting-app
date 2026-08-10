export const clientScripts = `
(() => {
  const sheet = document.querySelector("[data-dues-sheet]");
  if (!sheet) return;

  const table = sheet.querySelector("table");
  const columns = Array.from(sheet.querySelectorAll("col"));
  const controls = Array.from(document.querySelectorAll("[data-width-control]"));
  if (!table || controls.length === 0) return;

  const storageKey = sheet.getAttribute("data-width-storage-key") || "member-dues-widths";
  const defaults = Object.fromEntries(controls.map((control) => [control.dataset.widthProperty, Number(control.value)]));

  function columnForProperty(property) {
    return columns.find((column) => (column.getAttribute("style") || "").includes(property));
  }

  function readWidths() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  }

  function applyWidths(widths) {
    let total = 0;
    for (const control of controls) {
      const property = control.dataset.widthProperty;
      if (!property) continue;
      const width = Math.max(70, Math.min(900, Number(widths[property]) || Number(control.value)));
      control.value = String(width);
      sheet.style.setProperty(property, width + "px");
      const column = columnForProperty(property);
      if (column) column.style.width = width + "px";
      total += width;
    }
    table.style.width = total + "px";
    table.style.minWidth = total + "px";
    sheet.style.setProperty("--dues-table-width", total + "px");
    localStorage.setItem(storageKey, JSON.stringify(widths));
  }

  function saveControlWidth(control) {
    const property = control.dataset.widthProperty;
    if (!property) return;
    const widths = readWidths();
    widths[property] = Number(control.value);
    applyWidths(widths);
  }

  for (const control of controls) {
    control.addEventListener("input", () => saveControlWidth(control));
    control.addEventListener("change", () => saveControlWidth(control));
  }

  const reset = document.querySelector("[data-dues-reset-widths]");
  if (reset) {
    reset.addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      applyWidths({ ...defaults });
    });
  }

  applyWidths(readWidths());
})();
`;
