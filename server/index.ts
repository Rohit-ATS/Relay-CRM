import { createServer } from "node:http";
import { generateSequence } from "./sequence";

const port = Number(process.env.RELAY_SERVER_PORT ?? 8787);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/api/sequence") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await generateSequence(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid sequence request";
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: message }));
  }
}).listen(port, () => console.log(`Relay API listening on http://localhost:${port}`));
