import { getStore } from "@netlify/blobs";

// Safe in-memory store so API calls never crash if Blobs is unlinked
let memoryProperties = [
  { id: "spanish-palms", name: "Spanish Palms", slug: "spanish-palms" }
];
let memoryInspections = [];
let memoryReports = [];

async function safeBlobGet(store, key, fallback) {
  try {
    const data = await store.get(key, { type: "json" });
    return data || fallback;
  } catch (e) {
    return fallback;
  }
}

async function safeBlobSet(store, key, value) {
  try {
    await store.setJSON(key, value);
  } catch (e) {}
}

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "");
  const method = req.method;

  let store = null;
  try {
    store = getStore("stair-inspections");
  } catch (e) {
    store = null;
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const defaultConditions = [
    { code: "PASS", label: "Pass", flagged: false },
    { code: "C", label: "Cracked", flagged: true },
    { code: "N", label: "New", flagged: false },
    { code: "MON", label: "Monitor", flagged: false },
    { code: "HSW", label: "Hazard / Safety Warning", flagged: true }
  ];

  try {
    // GET Endpoints
    if (method === "GET") {
      if (path.includes("/conditions")) {
        return new Response(JSON.stringify(defaultConditions), { headers });
      }

      if (path.includes("/properties")) {
        if (store) {
          const blobProps = await safeBlobGet(store, "properties", memoryProperties);
          if (blobProps && blobProps.length) memoryProperties = blobProps;
        }
        return new Response(JSON.stringify(memoryProperties), { headers });
      }

      if (path.includes("/inspections")) {
        if (store) {
          const blobInsp = await safeBlobGet(store, "inspections", memoryInspections);
          if (blobInsp) memoryInspections = blobInsp;
        }
        return new Response(JSON.stringify(memoryInspections), { headers });
      }

      if (path.includes("/reports")) {
        if (store) {
          const blobRep = await safeBlobGet(store, "reports", memoryReports);
          if (blobRep) memoryReports = blobRep;
        }
        return new Response(JSON.stringify(memoryReports), { headers });
      }
    }

    // POST Endpoints
    if (method === "POST") {
      const body = await req.json().catch(() => ({}));

      if (path.includes("/properties")) {
        const propName = body.name || body.propertyName || (typeof body === 'string' ? body : "New Property");
        const slug = propName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const newProp = { id: slug, name: propName, slug };

        if (!memoryProperties.some(p => p.name === propName || p.id === slug)) {
          memoryProperties.push(newProp);
        }

        if (store) {
          await safeBlobSet(store, "properties", memoryProperties);
        }

        return new Response(JSON.stringify(memoryProperties), { headers });
      }

      if (path.includes("/inspections")) {
        const inspectionId = Date.now().toString();
        const stepCount = parseInt(body.stepCount || body.treads || 17, 10);
        
        const treads = [];
        for (let i = 1; i <= stepCount; i++) {
          treads.push({
            stepNumber: i,
            step: i,
            condition: "PASS",
            conditionLabel: "Pass",
            flagged: false,
            notes: "",
            photos: []
          });
        }

        const building = body.building || "1";
        const unit = body.unit || "101";
        const propertyId = body.propertyId || (memoryProperties[0] ? memoryProperties[0].id : "spanish-palms");
        const periodLabel = body.periodLabel || "Summer 2026 cycle";

        const photoKeyPrefix = `${propertyId}/${building}/${unit}/${periodLabel}`;
        const newInspection = {
          id: inspectionId,
          inspectionId,
          propertyId,
          building,
          unit,
          periodLabel,
          periodStart: body.periodStart || "",
          periodEnd: body.periodEnd || "",
          inspectedOn: body.inspectedOn || new Date().toISOString().split('T')[0],
          inspector: body.inspector || "",
          notes: body.notes || "",
          photoKeyPrefix,
          flaggedSteps: [],
          photoCount: 0,
          treads,
          stepCount
        };

        memoryInspections.push(newInspection);

        if (store) {
          await safeBlobSet(store, "inspections", memoryInspections);
        }

        return new Response(JSON.stringify({
          ...newInspection,
          inspection: newInspection,
          inspections: memoryInspections
        }), { headers });
      }

      if (path.includes("/reports")) {
        const newReport = {
          id: Date.now().toString(),
          title: body.title || "Stair Tread Condition Survey",
          periodLabel: body.periodLabel || "Summer 2026 cycle",
          status: "queued",
          staircaseCount: memoryInspections.length || 1,
          treadCount: memoryInspections.length * 17 || 17,
          flaggedCount: 0,
          photoCount: 0,
          pageCount: 1
        };
        memoryReports.push(newReport);
        if (store) {
          await safeBlobSet(store, "reports", memoryReports);
        }
        return new Response(JSON.stringify(newReport), { headers });
      }
    }

    return new Response(JSON.stringify({ error: "Route not found" }), { status: 404, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};
