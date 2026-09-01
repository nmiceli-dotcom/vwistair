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
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // GET /properties or /audits
    if (method === "GET") {
      if (path.includes("/properties")) {
        const properties = await store.get("properties", { type: "json" }) || ["Spanish Palms"];
        return new Response(JSON.stringify(properties), { headers });
      }

      const records = await store.get("records", { type: "json" }) || [];
      return new Response(JSON.stringify(records), { headers });
    }

    // POST /properties or /audits
    if (method === "POST") {
      const body = await req.json();

      if (path.includes("/properties")) {
        const properties = await store.get("properties", { type: "json" }) || ["Spanish Palms"];
        if (!properties.includes(body.name)) {
          properties.push(body.name);
          await store.setJSON("properties", properties);
        }
        return new Response(JSON.stringify({ success: true, properties }), { headers });
      }

      // Save staircase record
      const records = await store.get("records", { type: "json" }) || [];
      const index = records.findIndex(r => r.building === body.building && r.unit === body.unit);
      if (index >= 0) {
        records[index] = { ...records[index], ...body, updatedAt: new Date().toISOString() };
      } else {
        records.push({ ...body, createdAt: new Date().toISOString() });
      }
      await store.setJSON("records", records);

      return new Response(JSON.stringify({ success: true, record: body }), { headers });
    }

    return new Response(JSON.stringify({ error: "Route not found" }), { status: 404, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};
