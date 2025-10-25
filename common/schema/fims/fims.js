import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.FIMS_PORT || 3000;
const LOG = path.join(__dirname, "../logs");
fs.mkdirSync(LOG, { recursive: true });

const ajv = new Ajv({ allErrors: true });
const flightplanSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../common/schema/flightplan.schema.json"))
);
const eventSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../common/schema/event.schema.json"))
);
const validatePlan = ajv.compile(flightplanSchema);
const validateEvent = ajv.compile(eventSchema);

// 接続中のUASSP（Webhook URLの登録）
const subscribers = new Map(); // name -> { webhook }

function nowISO() { return new Date().toISOString(); }
function logFIMS(obj) {
  fs.appendFileSync(path.join(LOG, "fims.ndjson"), JSON.stringify(obj) + "\n");
}

// UASSPの登録（Webhook URLを受け付け）
app.post("/api/register", (req, res) => {
  const { name, webhook } = req.body || {};
  if (!name || !webhook) return res.status(400).json({ error: "name/webhook required" });
  subscribers.set(name, { webhook });
  logFIMS({ ts: nowISO(), who: "FIMS", msg: "REGISTER", name, webhook });
  res.json({ ok: true });
});

// フライトプラン受領（UASSP→FIMS）
app.post("/api/flightplans", (req, res) => {
  const plan = req.body;
  if (!validatePlan(plan)) return res.status(400).json({ error: "invalid plan", details: validatePlan.errors });
  // ここで本来は承認/衝突確認。簡易に「承認済み」で返す
  const ack = { ok: true, approvedAt: nowISO() };
  logFIMS({ ts: nowISO(), who: "FIMS", msg: "PLAN_ACCEPTED", flightPlanId: plan.flightPlanId });
  res.json(ack);
});

// イベント受領（UASSP→FIMS）→ 他UASSPへ配信
app.post("/api/events", async (req, res) => {
  const evt = req.body;
  if (!validateEvent(evt)) return res.status(400).json({ error: "invalid event", details: validateEvent.errors });
  // FIMSホップのタイムスタンプをtraceに追加
  evt.trace = evt.trace || [];
  evt.trace.push({ hop: "FIMS_CORE", ts: nowISO() });
  logFIMS({ ts: nowISO(), who: "FIMS", msg: "EVENT_IN", eventId: evt.eventId, type: evt.type });

  // 発信元以外のUASSPへ通知
  const origin = evt.trace.find(t => t.hop === "UASSP_ORIGIN")?.name;
  const tasks = [];
  for (const [name, { webhook }] of subscribers.entries()) {
    if (name === origin) continue;
    tasks.push(fetch(webhook + "/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evt)
    }).catch(() => null));
  }
  await Promise.all(tasks);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`FIMS listening on http://localhost:${PORT}`);
});
