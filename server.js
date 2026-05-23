import { createServer } from "node:http";
import { config } from "dotenv";

config({ quiet: true });

const port = Number(process.env.PORT) || 3000;

const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Nonprofit Ledger server is running.");
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
