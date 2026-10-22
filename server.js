const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
// Local credentials stay outside the Git repository. Environment values take priority.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
}
const CONTENT_FILE = path.join(ROOT, "data", "content.json");
const INQUIRIES_FILE = path.join(ROOT, "data", "inquiries.json");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error("Yönetici bilgileri eksik. .env.example dosyasını .env olarak kopyalayıp doldurun.");
}
const sessions = new Map();
const inquiryLimits = new Map();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(INQUIRIES_FILE)) fs.writeFileSync(INQUIRIES_FILE, "[]", "utf8");

const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml"
};

function json(res, status, value, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(value));
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) reject(new Error("Dosya çok büyük"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Geçersiz veri")); }
    });
    req.on("error", reject);
  });
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(v => v.trim().split("=")));
}

function authenticated(req) {
  const token = cookies(req).lagom_admin;
  return token && sessions.has(token) && sessions.get(token) > Date.now();
}

function safeContent(value) {
  if (!value || !Array.isArray(value.sections)) throw new Error("İçerik yapısı geçersiz");
  return value;
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/content") {
    return json(res, 200, JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8")));
  }
  if (req.method === "GET" && url.pathname === "/api/session") {
    return json(res, 200, { authenticated: Boolean(authenticated(req)) });
  }
  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req, 1024);
    if (body.username !== ADMIN_USERNAME || body.password !== ADMIN_PASSWORD) return json(res, 401, { error: "Kullanıcı adı veya şifre hatalı" });
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
    return json(res, 200, { ok: true }, { "Set-Cookie": `lagom_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
  }
  if (req.method === "POST" && url.pathname === "/api/logout") {
    const token = cookies(req).lagom_admin;
    if (token) sessions.delete(token);
    return json(res, 200, { ok: true }, { "Set-Cookie": "lagom_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (req.method === "POST" && url.pathname === "/api/inquiries") {
    const ip = req.socket.remoteAddress || "unknown";
    const recent = (inquiryLimits.get(ip) || []).filter(time => Date.now() - time < 60 * 60 * 1000);
    if (recent.length >= 5) return json(res, 429, { error: "Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin." });
    const body = await readBody(req, 20 * 1024);
    if (body.company) return json(res, 201, { ok: true });
    const name = String(body.name || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
    const message = String(body.message || "").trim().slice(0, 3000);
    if (name.length < 3) return json(res, 400, { error: "Lütfen adınızı ve soyadınızı yazın." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: "Geçerli bir e-posta adresi yazın." });
    if (message.length < 10) return json(res, 400, { error: "Lütfen isteğinizi biraz daha ayrıntılı yazın." });
    const inquiries = JSON.parse(fs.readFileSync(INQUIRIES_FILE, "utf8"));
    inquiries.unshift({ id: crypto.randomUUID(), name, email, message, createdAt: new Date().toISOString(), read: false });
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2), "utf8");
    recent.push(Date.now()); inquiryLimits.set(ip, recent);
    return json(res, 201, { ok: true });
  }
  if (!authenticated(req)) return json(res, 401, { error: "Oturum gerekli" });
  if (req.method === "GET" && url.pathname === "/api/inquiries") {
    return json(res, 200, JSON.parse(fs.readFileSync(INQUIRIES_FILE, "utf8")));
  }
  const inquiryMatch = /^\/api\/inquiries\/([a-f0-9-]+)$/.exec(url.pathname);
  if (inquiryMatch && (req.method === "PATCH" || req.method === "DELETE")) {
    const inquiries = JSON.parse(fs.readFileSync(INQUIRIES_FILE, "utf8"));
    const index = inquiries.findIndex(item => item.id === inquiryMatch[1]);
    if (index < 0) return json(res, 404, { error: "İstek bulunamadı" });
    if (req.method === "DELETE") inquiries.splice(index, 1);
    else inquiries[index].read = Boolean((await readBody(req, 1024)).read);
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2), "utf8");
    return json(res, 200, { ok: true });
  }
  if (req.method === "PUT" && url.pathname === "/api/content") {
    const body = safeContent(await readBody(req, 5 * 1024 * 1024));
    const temp = `${CONTENT_FILE}.tmp`;
    fs.copyFileSync(CONTENT_FILE, path.join(ROOT, "data", "content.backup.json"));
    fs.writeFileSync(temp, JSON.stringify(body, null, 2), "utf8");
    fs.renameSync(temp, CONTENT_FILE);
    return json(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/upload") {
    const body = await readBody(req);
    const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(body.data || "");
    if (!match) return json(res, 400, { error: "Yalnızca JPG, PNG veya WebP yükleyin" });
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[2], "base64"));
    return json(res, 201, { src: `uploads/${filename}` });
  }
  json(res, 404, { error: "Bulunamadı" });
}

function staticFile(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin") pathname = "/admin.html";
  const file = path.resolve(ROOT, `.${pathname}`);
  const relative = path.relative(ROOT, file);
  const publicFiles = new Set(["index.html", "admin.html", "admin.css", "admin.js", "inquiries.css", "panel-tabs.css", "intro-transition.js", "site-content.js"]);
  const image = /\.(png|jpe?g|gif|webp|svg)$/i.test(relative);
  const privatePath = relative.split(/[\\/]/).some(part => part.startsWith(".") || ["data", "tests", "node_modules"].includes(part));
  if (relative.startsWith("..") || path.isAbsolute(relative) || privatePath || (!publicFiles.has(relative) && !image) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("Bulunamadı");
  }
  res.writeHead(200, { "Content-Type": mimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": pathname.startsWith("/uploads/") ? "public, max-age=31536000" : "no-cache" });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try { url.pathname.startsWith("/api/") ? await api(req, res, url) : staticFile(req, res, url); }
  catch (error) { json(res, 400, { error: error.message || "İşlem başarısız" }); }
}).listen(PORT, () => console.log(`Lagom sitesi: http://localhost:${PORT}\nAdmin paneli: http://localhost:${PORT}/admin`));
