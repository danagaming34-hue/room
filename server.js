const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const HOST = "::";
const START_PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "rooms.json");
const MAX_BODY_BYTES = 22 * 1024 * 1024;
const MAX_MESSAGES_PER_ROOM = 400;
const MAX_ATTACHMENTS = 8;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

let store = { rooms: {} };
const sseClients = new Map();
let saveTimer = null;

loadStore();

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, parsedUrl);
      return;
    }

    if (pathname.startsWith("/events/")) {
      handleEvents(req, res, pathname);
      return;
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, { error: error.status ? error.message : "Something broke on the server." });
  }
});

listenOnAvailablePort(START_PORT);

function listenOnAvailablePort(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT && port < START_PORT + 20) {
      listenOnAvailablePort(port + 1);
      return;
    }

    throw error;
  });

  const listenOptions = HOST === "::"
    ? { port, host: HOST, ipv6Only: false }
    : { port, host: HOST };

  server.listen(listenOptions, () => {
    const localAddresses = getLocalAddresses(port);
    console.log(`Rooms chat is running.`);
    console.log(`Local:   http://localhost:${port}`);
    localAddresses.forEach((address) => console.log(`Network: http://${address}:${port}`));
  });
}

async function handleApi(req, res, parsedUrl) {
  const parts = parsedUrl.pathname.split("/").filter(Boolean);
  const roomId = parts[2];
  const messageId = parts[4];

  if (parts[0] !== "api" || parts[1] !== "rooms" || !isValidRoom(roomId)) {
    sendJson(res, 404, { error: "Room not found." });
    return;
  }

  if (parts.length === 3 && req.method === "GET") {
    const room = getRoom(roomId);
    sendJson(res, 200, { room: roomId, messages: room.messages });
    return;
  }

  if (parts.length === 4 && parts[3] === "messages" && req.method === "POST") {
    const body = await readJsonBody(req);
    const message = createMessage(roomId, body);
    const room = getRoom(roomId);
    room.messages.push(message);
    trimRoom(room);
    queueSave();
    broadcast(roomId, "message", message);
    sendJson(res, 201, { message });
    return;
  }

  if (parts.length === 5 && parts[3] === "messages" && messageId && req.method === "PATCH") {
    const body = await readJsonBody(req);
    const room = getRoom(roomId);
    const message = room.messages.find((item) => item.id === messageId);

    if (!message) {
      sendJson(res, 404, { error: "Message not found." });
      return;
    }

    message.text = cleanText(body.text);
    message.updatedAt = new Date().toISOString();
    queueSave();
    broadcast(roomId, "update", message);
    sendJson(res, 200, { message });
    return;
  }

  if (parts.length === 5 && parts[3] === "messages" && messageId && req.method === "DELETE") {
    const room = getRoom(roomId);
    const before = room.messages.length;
    room.messages = room.messages.filter((item) => item.id !== messageId);

    if (room.messages.length === before) {
      sendJson(res, 404, { error: "Message not found." });
      return;
    }

    queueSave();
    broadcast(roomId, "delete", { id: messageId });
    sendJson(res, 200, { id: messageId });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
}

function handleEvents(req, res, pathname) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const roomId = pathname.slice("/events/".length);
  if (!isValidRoom(roomId)) {
    sendJson(res, 404, { error: "Room not found." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ room: roomId })}\n\n`);

  if (!sseClients.has(roomId)) {
    sseClients.set(roomId, new Set());
  }

  const clients = sseClients.get(roomId);
  clients.add(res);
  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(roomId);
    }
  });
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          sendJson(res, 404, { error: "Not found." });
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(req.method === "HEAD" ? undefined : fallback);
      });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : contents);
  });
}

function createMessage(roomId, body) {
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.slice(0, MAX_ATTACHMENTS).map(cleanAttachment).filter(Boolean)
    : [];
  const text = cleanText(body.text);

  if (!text && attachments.length === 0) {
    throw Object.assign(new Error("Empty message."), { status: 400 });
  }

  return {
    id: crypto.randomUUID(),
    room: roomId,
    sender: cleanSender(body.sender),
    clientId: cleanClientId(body.clientId),
    text,
    attachments,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

function cleanText(value) {
  return String(value || "").replace(/\u0000/g, "").slice(0, 12000);
}

function cleanSender(value) {
  const sender = String(value || "").replace(/\s+/g, " ").trim().slice(0, 40);
  return sender || "Guest";
}

function cleanClientId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function cleanAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  const dataUrl = String(attachment.dataUrl || "");
  if (!dataUrl.startsWith("data:") || dataUrl.length > 10 * 1024 * 1024) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: String(attachment.name || "attachment").replace(/[^\w .()[\]-]/g, "_").slice(0, 120),
    type: String(attachment.type || "application/octet-stream").slice(0, 120),
    size: Number(attachment.size) || 0,
    dataUrl,
  };
}

function getRoom(roomId) {
  if (!store.rooms[roomId]) {
    store.rooms[roomId] = { messages: [] };
  }

  return store.rooms[roomId];
}

function trimRoom(room) {
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages = room.messages.slice(room.messages.length - MAX_MESSAGES_PER_ROOM);
  }
}

function broadcast(roomId, event, payload) {
  const clients = sseClients.get(roomId);
  if (!clients) {
    return;
  }

  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => client.write(data));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request too large."), { status: 413 });
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("Invalid JSON."), { status: 400 });
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function isValidRoom(roomId) {
  return /^[0-9]{1,12}$/.test(String(roomId || ""));
}

function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.rooms) {
      store = parsed;
    }
  } catch {
    store = { rooms: {} };
  }
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStore, 150);
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function getLocalAddresses(port) {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((networkInterface) => {
    (networkInterface || []).forEach((details) => {
      if (details.family === "IPv4" && !details.internal) {
        addresses.push(`${details.address}`);
      }
    });
  });

  return addresses;
}

process.on("SIGINT", () => {
  saveStore();
  process.exit(0);
});

process.on("SIGTERM", () => {
  saveStore();
  process.exit(0);
});
