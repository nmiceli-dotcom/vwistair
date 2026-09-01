import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "");
  const method = req.method;

  const store = getStore("stair-inspections");

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
        let properties = await store.get("properties", { type: "json" });
        if (!properties || !properties.length) {
          properties = [
            { id: "spanish-palms", name: "Spanish Palms", slug: "spanish-palms" }
          ];
        }
        return new Response(JSON.stringify(properties), { headers });
      }

      if (path.includes("/inspections")) {
        const inspections = (await store.get("inspections", { type: "json" })) || [];
        return new Response(JSON.stringify(inspections), { headers });
      }

      if (path.includes("/reports")) {
        const reports = (await store.get("reports", { type: "json" })) || [];
        return new Response(JSON.stringify(reports), { headers });
      }
    }

    // POST Endpoints
    if (method === "POST") {
      const body = await req.json().catch(() => ({}));

      if (path.includes("/properties")) {
        let properties = (await store.get("properties", { type: "json" })) || [
          { id: "spanish-palms", name: "Spanish Palms", slug: "spanish-palms" }
        ];
        
        const propName = body.name || body.propertyName || (typeof body === 'string' ? body : "New Property");
        const slug = propName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const newProp = { id: slug, name: propName, slug };
        
        if (!properties.some(p => p.name === propName || p.id === slug)) {
          properties.push(newProp);
          await store.setJSON("properties", properties);
        }

        return new Response(JSON.stringify(properties), { headers });
      }

      if (path.includes("/inspections")) {
        const inspections = (await store.get("inspections", { type: "json" })) || [];
        const inspectionId = Date.now();
        
        const treads = [];
        for (let i = 1; i <= (body.stepCount || 17); i++) {
          treads.push({
            stepNumber: i,
            condition: "PASS",
            conditionLabel: "Pass",
            flagged: false,
            notes: "",
            photos: []
          });
        }

        const photoKeyPrefix = `${body.propertyId || "spanish-palms"}/${body.building}/${body.unit}/${body.periodLabel || "cycle"}`;
        const newInspection = {
          inspectionId,
          propertyId: body.propertyId || "spanish-palms",
          building: body.building,
          unit: body.unit,
          periodLabel: body.periodLabel || "Cycle",
          periodStart: body.periodStart || "",
          periodEnd: body.periodEnd || "",
          inspector: body.inspector || "",
          photoKeyPrefix,
          flaggedSteps: [],
          photoCount: 0,
          treads
        };

        inspections.push(newInspection);
        await store.setJSON("inspections", inspections);
        return new Response(JSON.stringify(newInspection), { headers });
      }

      if (path.includes("/reports")) {
        const reports = (await store.get("reports", { type: "json" })) || [];
        const newReport = {
          id: Date.now(),
          title: body.title || "Stair Tread Condition Survey",
          periodLabel: body.periodLabel || "Cycle",
          status: "queued",
          staircaseCount: 1,
          treadCount: 17,
          flaggedCount: 0,
          photoCount: 0,
          pageCount: 1
        };
        reports.push(newReport);
        await store.setJSON("reports", reports);
        return new Response(JSON.stringify(newReport), { headers });
      }
    }

    return new Response(JSON.stringify({ error: "Route not found" }), { status: 404, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};
