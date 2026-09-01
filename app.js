/* Tread Record — field client.
   Talks to /api/properties, /api/inspections, /api/photos, /api/records and
   /api/reports. Photos are downscaled in the browser before upload so the
   payload stays small and the report generator always gets embeddable JPEG. */

const state = {
  properties: [],
  propertyId: null,
  staircases: [],
  selectedId: null,
  conditions: [],
  reports: [],
  pollTimer: null,
};

const $ = (id) => document.getElementById(id);

/* ── plumbing ─────────────────────────────────────────────── */

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const isJson = (response.headers.get("content-type") || "").includes("json");
  const body = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(body?.error || `${response.status} ${response.statusText}`);
  }
  return body;
}

let toastTimer;
function toast(message, kind = "info") {
  const el = $("toast");
  el.textContent = message;
  el.dataset.kind = kind;
  el.dataset.show = "true";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.dataset.show = "false"), kind === "error" ? 6500 : 3800);
}

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/**
 * Re-encodes a photo to a bounded JPEG. Keeps uploads well under the function
 * payload ceiling and normalizes phone formats (including HEIC on iOS, which
 * the browser decodes natively) to something embeddable in the PDF.
 */
async function downscale(file, maxEdge = 2000, quality = 0.82) {
  if (!/^image\//.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file; // Server-side validation is the backstop.
  }
}

/* ── properties ───────────────────────────────────────────── */

async function loadProperties() {
  const { properties } = await api("/api/properties");
  state.properties = properties;
  const select = $("property");
  select.innerHTML = properties.length
    ? properties
        .map((p) => `<option value="${p.id}">${esc(p.name)} — ${esc(p.slug)}</option>`)
        .join("")
    : `<option value="">No properties yet</option>`;

  if (properties.length) {
    const keep = properties.some((p) => p.id === state.propertyId);
    state.propertyId = keep ? state.propertyId : properties[0].id;
    select.value = String(state.propertyId);
  } else {
    state.propertyId = null;
  }
}

$("new-property").addEventListener("click", async () => {
  const name = prompt("Property name (e.g. Elm Court Apartments)");
  if (!name?.trim()) return;
  const address = prompt("Street address (optional)") ?? "";
  const clientName = prompt("Client / managing agent (optional)") ?? "";
  try {
    const { property, created } = await api("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, clientName }),
    });
    state.propertyId = property.id;
    await loadProperties();
    $("property").value = String(property.id);
    await refreshProperty();
    toast(created ? `Added ${property.name}` : `${property.name} already existed`);
  } catch (error) {
    toast(error.message, "error");
  }
});

$("property").addEventListener("change", (event) => {
  state.propertyId = Number(event.target.value) || null;
  state.selectedId = null;
  refreshProperty();
});

/* ── staircases ───────────────────────────────────────────── */

async function refreshProperty() {
  if (!state.propertyId) {
    state.staircases = [];
    state.reports = [];
    renderStaircases();
    renderTreads();
    renderReports();
    return;
  }
  const [{ inspections }, { reports }] = await Promise.all([
    api(`/api/inspections?propertyId=${state.propertyId}`),
    api(`/api/reports?propertyId=${state.propertyId}`),
  ]);
  state.staircases = inspections;
  state.reports = reports;
  if (!state.staircases.some((s) => s.inspectionId === state.selectedId)) {
    state.selectedId = state.staircases.at(-1)?.inspectionId ?? null;
  }
  renderStaircases();
  renderTreads();
  renderReports();
  schedulePoll();
}

function renderStaircases() {
  const list = $("staircase-list");
  $("staircase-count").textContent = state.staircases.length
    ? `${state.staircases.length} logged`
    : "none";

  if (!state.staircases.length) {
    list.innerHTML = `<p class="empty" style="padding:22px 6px">No staircases logged for this property yet.</p>`;
    return;
  }

  list.innerHTML = state.staircases
    .map((s) => {
      const flags = s.flaggedSteps.length;
      return `<button type="button" class="staircase" data-id="${s.inspectionId}" aria-current="${s.inspectionId === state.selectedId}">
        <strong>${esc(s.building)} · ${esc(s.unit)}</strong>
        <span class="badge ${flags ? "flagged" : ""}">${flags ? `${flags} flagged` : "clear"}</span>
        <span class="period">${esc(s.periodLabel)} · ${s.periodStart} → ${s.periodEnd} · ${s.treads.length} treads · ${s.photoCount} photo${s.photoCount === 1 ? "" : "s"}</span>
      </button>`;
    })
    .join("");

  list.querySelectorAll(".staircase").forEach((button) =>
    button.addEventListener("click", () => {
      state.selectedId = Number(button.dataset.id);
      renderStaircases();
      renderTreads();
    }),
  );
}

const selected = () =>
  state.staircases.find((s) => s.inspectionId === state.selectedId) ?? null;

/* ── treads ───────────────────────────────────────────────── */

function renderTreads() {
  const staircase = selected();
  const list = $("tread-list");

  if (!staircase) {
    $("tread-title").textContent = "No staircase selected";
    $("tread-sub").textContent = "Pick a staircase, or log a new one.";
    $("key-line").innerHTML = "";
    $("flag-tally").innerHTML = "";
    list.innerHTML = `<div class="empty"><p>Every tread is recorded, not just the damaged ones. Photos attach to the treads you flag.</p></div>`;
    return;
  }

  $("tread-title").textContent = `${staircase.building} · ${staircase.unit}`;
  $("tread-sub").textContent =
    `${staircase.periodLabel} · ${staircase.periodStart} → ${staircase.periodEnd}` +
    (staircase.inspector ? ` · ${staircase.inspector}` : "");
  $("key-line").innerHTML =
    `<span>photo key prefix</span> ${esc(staircase.photoKeyPrefix)}/step-N/`;

  const tally = {};
  for (const tread of staircase.treads) {
    tally[tread.conditionLabel] = (tally[tread.conditionLabel] ?? 0) + 1;
  }
  $("flag-tally").innerHTML = Object.entries(tally)
    .map(([label, n]) => {
      const flagged = staircase.treads.some((t) => t.conditionLabel === label && t.flagged);
      return `<b class="${flagged ? "hot" : ""}">${esc(label)} ${n}</b>`;
    })
    .join("");

  list.innerHTML = staircase.treads
    .map((tread) => {
      const chips = state.conditions
        .map(
          (c) => `<button type="button" class="chip" data-step="${tread.stepNumber}" data-condition="${c.code}"
            data-flagged="${c.flagged}" aria-pressed="${tread.condition === c.code}">${esc(c.label)}</button>`,
        )
        .join("");

      const photos = tread.photos
        .map(
          (photo) => `<figure class="photo">
            <a href="${esc(photo.url)}" target="_blank" rel="noopener">
              <img src="/.netlify/images?url=${encodeURIComponent(photo.url)}&w=200&h=140&fit=cover" alt="Step ${tread.stepNumber} defect photo" loading="lazy" />
            </a>
            <button type="button" class="remove-photo" data-photo="${photo.id}" title="Delete photo" aria-label="Delete photo">×</button>
            <figcaption>${esc(photo.caption || `step ${photo.stepNumber}`)}</figcaption>
          </figure>`,
        )
        .join("");

      const showUpload = tread.flagged || tread.photos.length > 0;

      return `<div class="tread ${tread.flagged ? "flagged" : ""}">
        <div class="step">${tread.stepNumber}</div>
        <div class="tread-body">
          <div class="chips">${chips}</div>
          <input class="tread-note" data-step="${tread.stepNumber}" value="${esc(tread.notes)}"
            placeholder="${tread.flagged ? "Describe the defect, extent, and recommendation" : "Notes (optional)"}" />
          ${
            showUpload
              ? `<div class="photo-strip">${photos}
                  <label class="upload" data-step="${tread.stepNumber}">
                    <input type="file" accept="image/*" capture="environment" />
                    <span>Add photo</span>
                  </label>
                </div>`
              : ""
          }
        </div>
      </div>`;
    })
    .join("");

  wireTreads(staircase);
}

function wireTreads(staircase) {
  const list = $("tread-list");

  list.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", async () => {
      const step = Number(chip.dataset.step);
      try {
        await api(`/api/inspections/${staircase.inspectionId}/treads/${step}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ condition: chip.dataset.condition }),
        });
        await refreshProperty();
      } catch (error) {
        toast(error.message, "error");
      }
    }),
  );

  list.querySelectorAll(".tread-note").forEach((input) => {
    let last = input.value;
    const save = async () => {
      if (input.value === last) return;
      last = input.value;
      try {
        await api(
          `/api/inspections/${staircase.inspectionId}/treads/${input.dataset.step}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: input.value }),
          },
        );
        const tread = staircase.treads.find(
          (t) => t.stepNumber === Number(input.dataset.step),
        );
        if (tread) tread.notes = input.value;
        toast(`Step ${input.dataset.step} notes saved`);
      } catch (error) {
        toast(error.message, "error");
      }
    };
    input.addEventListener("blur", save);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
    });
  });

  list.querySelectorAll(".upload").forEach((label) => {
    const input = label.querySelector("input");
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      label.dataset.busy = "true";
      label.querySelector("span").textContent = "Uploading…";
      try {
        const prepared = await downscale(file);
        const form = new FormData();
        form.append("file", prepared);
        form.append("inspectionId", String(staircase.inspectionId));
        form.append("stepNumber", label.dataset.step);
        form.append("takenBy", staircase.inspector || "");
        const result = await api("/api/photos", { method: "POST", body: form });
        toast(result.warning ?? `Photo saved to ${result.photo.blobKey}`, result.warning ? "error" : "info");
        await refreshProperty();
      } catch (error) {
        toast(error.message, "error");
        label.dataset.busy = "false";
        label.querySelector("span").textContent = "Add photo";
      }
    });
  });

  list.querySelectorAll(".remove-photo").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!confirm("Delete this photo? The report will no longer include it.")) return;
      try {
        await api(`/api/photos/${button.dataset.photo}`, { method: "DELETE" });
        await refreshProperty();
        toast("Photo deleted");
      } catch (error) {
        toast(error.message, "error");
      }
    }),
  );
}

/* ── new staircase ────────────────────────────────────────── */

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

function updateKeyPreview() {
  const form = $("inspection-form");
  const data = new FormData(form);
  const property = state.properties.find((p) => p.id === state.propertyId);
  const label = slugify(data.get("periodLabel"));
  const start = data.get("periodStart");
  const end = data.get("periodEnd");
  const range = start && end ? `${start}-to-${end}` : "";
  const period = slugify([label, range].filter(Boolean).join("-"));
  $("key-preview").textContent = [
    property?.slug || "property",
    slugify(data.get("building")) || "building",
    slugify(data.get("unit")) || "unit",
    period || "period",
  ].join("/") + "/step-N/";
}

$("inspection-form").addEventListener("input", updateKeyPreview);

$("inspection-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.propertyId) return toast("Add a property first", "error");

  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const { inspection, photoKeyPrefix } = await api("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: state.propertyId,
        building: data.building,
        unit: data.unit,
        periodLabel: data.periodLabel,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        inspectedOn: data.inspectedOn || undefined,
        inspector: data.inspector,
        stepCount: Number(data.stepCount) || 17,
        notes: data.notes,
      }),
    });
    state.selectedId = inspection.id;
    form.reset();
    $("new-inspection").open = false;
    updateKeyPreview();
    await refreshProperty();
    toast(`Staircase logged at ${photoKeyPrefix}/`);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

/* ── reports ──────────────────────────────────────────────── */

$("report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.propertyId) return toast("Add a property first", "error");

  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const { expected } = await api("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: state.propertyId,
        title: data.title || undefined,
        periodLabel: data.periodLabel || undefined,
        from: data.from || undefined,
        to: data.to || undefined,
        requestedBy: data.requestedBy || undefined,
      }),
    });
    toast(
      `Report queued: ${expected.staircases} staircases, ${expected.treads} treads, ${expected.photos} photos`,
    );
    await refreshProperty();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

function renderReports() {
  const list = $("report-list");
  if (!state.reports.length) {
    list.innerHTML = `<p class="empty" style="padding:18px 6px">No reports generated yet.</p>`;
    return;
  }
  list.innerHTML = state.reports
    .map((report) => {
      const counts = [
        report.staircaseCount != null ? `${report.staircaseCount} staircases` : null,
        report.treadCount != null ? `${report.treadCount} treads` : null,
        report.flaggedCount != null ? `${report.flaggedCount} flagged` : null,
        report.photoCount != null ? `${report.photoCount} photos` : null,
        report.pageCount != null ? `${report.pageCount} pages` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<div class="report ${esc(report.status)}">
        <div>
          <div class="title">${esc(report.title || "Untitled report")}</div>
          <div class="meta">${esc(report.periodLabel)} · ${counts}</div>
        </div>
        <span class="status">${esc(report.status)}</span>
        ${report.downloadUrl ? `<a href="${esc(report.downloadUrl)}">Download PDF</a>` : ""}
        ${report.error ? `<div class="error">${esc(report.error)}</div>` : ""}
      </div>`;
    })
    .join("");
}

/** Polls while a report is queued or running; stops as soon as none are. */
function schedulePoll() {
  clearTimeout(state.pollTimer);
  const pending = state.reports.some((r) => r.status === "queued" || r.status === "running");
  if (!pending || !state.propertyId) return;
  state.pollTimer = setTimeout(async () => {
    try {
      const { reports } = await api(`/api/reports?propertyId=${state.propertyId}`);
      const done = state.reports.filter((r) => r.status === "queued" || r.status === "running")
        .map((r) => r.id)
        .filter((id) => {
          const now = reports.find((r) => r.id === id);
          return now && now.status !== "queued" && now.status !== "running";
        });
      state.reports = reports;
      renderReports();
      if (done.length) {
        const finished = reports.find((r) => r.id === done[0]);
        toast(
          finished.status === "complete"
            ? `Report ready: ${finished.pageCount} pages`
            : `Report failed: ${finished.error ?? "unknown error"}`,
          finished.status === "complete" ? "info" : "error",
        );
      }
      schedulePoll();
    } catch {
      schedulePoll();
    }
  }, 4000);
}

/* ── boot ─────────────────────────────────────────────────── */

(async function start() {
  try {
    const [{ conditions }] = await Promise.all([api("/api/conditions"), loadProperties()]);
    state.conditions = conditions;
    updateKeyPreview();
    await refreshProperty();
  } catch (error) {
    toast(`Could not load: ${error.message}`, "error");
  }
})();
