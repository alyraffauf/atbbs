import { createServer, type Socket } from "node:net";
import { TelnetLoader } from "./loader.js";
import { runSession } from "./session.js";

const MAX_CONNECTIONS = 20;
const SHUTDOWN_GRACE_MS = 30_000;
const port = Number(process.env.TELNET_PORT ?? 2323);
const sockets = new Set<Socket>();
const loader = new TelnetLoader();
let shuttingDown = false;
const server = createServer((socket) => {
  if (shuttingDown || sockets.size >= MAX_CONNECTIONS) {
    socket.end("  Server is full. Try again later.\r\n");
    return;
  }
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
  void runSession(socket, loader).finally(() => socket.end());
});
server.listen(port, "0.0.0.0", () =>
  console.log(`Telnet BBS gateway listening on 0.0.0.0:${port}`),
);
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  const timer = setTimeout(() => {
    for (const socket of sockets) socket.destroy();
  }, SHUTDOWN_GRACE_MS);
  timer.unref();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
