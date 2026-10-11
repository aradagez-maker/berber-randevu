// İlhan Kuzu randevu sunucusu: sayfayı sunar, randevuları tek bir JSON dosyasında tutar.
// Ortam değişkenleri:
//   PORT      – Railway kendisi verir
//   APP_PIN   – dükkân şifresi (isteğe bağlı; yoksa ilk açan kişi uygulamadan belirler)
//   DATA_DIR  – verinin yazılacağı klasör (Railway Volume bağlıysa onun yolu kullanılır)
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const PIN = (process.env.APP_PIN || "").trim();
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "randevular.json");
const PUBLIC = path.join(__dirname, "public");

fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { appts: {}, settings: null };
try { db = { appts: {}, settings: null, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) }; } catch {}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

// Şifre: APP_PIN değişkeni ya da ilk açılışta uygulamadan belirlenen şifre
// Şifre unutulursa: dükkân sahibine verilen kurtarma kodunun özeti (kodun kendisi burada yok)
const RESET_HASH = "e8f68c416ae63ec5a1d9cf7442039bccde4723946538e983ae5fb7e79dbbc1bc";
const currentPin = () => PIN || db.pin || "";
function pinOk(req) {
  const pin = currentPin();
  if (!pin) return false;
  const got = Buffer.from(String(req.headers["x-pin"] || ""));
  const want = Buffer.from(pin);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 5_000_000) { reject(new Error("too big")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const str = (v, max) => String(v ?? "").slice(0, max);
function cleanAppt(b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !/^\d{2}:\d{2}$/.test(b.time)) return null;
  const dur = Math.min(600, Math.max(5, Number(b.dur) || 30));
  const status = ["wait", "came", "noshow"].includes(b.status) ? b.status : "wait";
  return { date: b.date, time: b.time, dur, name: str(b.name, 120), phone: str(b.phone, 40), service: str(b.service, 60), note: str(b.note, 500), status, createdAt: str(b.createdAt, 40), updatedAt: new Date().toISOString() };
}
function cleanSettings(b) {
  const t = (v, d) => (/^\d{2}:\d{2}$/.test(v) ? v : d);
  return { open: t(b.open, "09:00"), close: t(b.close, "21:00"), step: Math.min(120, Math.max(10, Number(b.step) || 30)), closed: Array.isArray(b.closed) ? b.closed.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [] };
}

const TYPES = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/manifest+json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  try {
    if (p === "/api/ping") return send(res, 200, { app: "ik-randevu", setup: !currentPin() });
    if (p === "/api/setup" && req.method === "POST") {
      if (currentPin()) return send(res, 409, { error: "already set" });
      const pin = str((await readBody(req)).pin, 32).trim();
      if (pin.length < 4) return send(res, 400, { error: "short" });
      db.pin = pin; save(); return send(res, 200, { ok: true });
    }
    if (p === "/api/reset" && req.method === "POST") {
      const b = await readBody(req);
      const code = str(b.code, 64).replace(/[\s-]/g, "").toUpperCase();
      const got = Buffer.from(crypto.createHash("sha256").update(code).digest("hex"));
      if (!crypto.timingSafeEqual(got, Buffer.from(RESET_HASH))) { await new Promise((r) => setTimeout(r, 1500)); return send(res, 403, { error: "code" }); }
      const pin = str(b.pin, 32).trim();
      if (pin.length < 4) return send(res, 400, { error: "short" });
      db.pin = pin; save();
      return send(res, 200, { ok: true });
    }
    // Sunucu boş açıldıysa (ör. yeniden başlatma sonrası) cihazdaki yedekten geri yükleme
    if (p === "/api/restore" && req.method === "POST") {
      if (currentPin() || Object.keys(db.appts).length) return send(res, 409, { error: "not empty" });
      const b = await readBody(req);
      const pin = str(b.pin, 32).trim();
      if (pin.length < 4) return send(res, 400, { error: "short" });
      db.pin = pin;
      db.settings = b.settings && typeof b.settings === "object" ? cleanSettings(b.settings) : null;
      for (const a of (Array.isArray(b.appts) ? b.appts : []).slice(0, 20000)) {
        if (!a || !/^[A-Za-z0-9_-]{1,64}$/.test(String(a.id))) continue;
        const c = cleanAppt(a);
        if (c) db.appts[a.id] = { ...c, createdAt: str(a.createdAt, 40), updatedAt: str(a.updatedAt, 40) || c.updatedAt };
      }
      save();
      return send(res, 200, { ok: true, restored: Object.keys(db.appts).length });
    }
    if (p.startsWith("/api/")) {
      if (!pinOk(req)) return send(res, 401, { error: "pin" });
      if (p === "/api/state" && req.method === "GET") return send(res, 200, { appts: Object.entries(db.appts).map(([id, a]) => ({ ...a, id })), settings: db.settings });
      if (p === "/api/settings" && req.method === "PUT") { db.settings = cleanSettings(await readBody(req)); save(); return send(res, 200, { ok: true }); }
      const m = p.match(/^\/api\/appts\/([A-Za-z0-9_-]{1,64})$/);
      if (m && req.method === "PUT") { const a = cleanAppt(await readBody(req)); if (!a) return send(res, 400, { error: "bad" }); db.appts[m[1]] = a; save(); return send(res, 200, { ok: true }); }
      if (m && req.method === "DELETE") { delete db.appts[m[1]]; save(); return send(res, 200, { ok: true }); }
      return send(res, 404, { error: "not found" });
    }
    let file = p === "/" ? "index.html" : p.slice(1);
    file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
    const full = path.join(PUBLIC, file);
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res, 404, "Bulunamadı", "text/plain; charset=utf-8");
    res.writeHead(200, { "content-type": TYPES[path.extname(full)] || "application/octet-stream", "cache-control": file === "index.html" ? "no-cache" : "public, max-age=86400" });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    send(res, 400, { error: "bad request" });
  }
});
server.listen(PORT, () => console.log(`Randevu sunucusu ${PORT} portunda. Veri: ${DB_FILE}. Şifre: ${currentPin() ? "ayarlı" : "ilk açılışta belirlenecek"}`));
