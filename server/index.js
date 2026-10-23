import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import Stripe from "stripe";
import { Pool } from "pg";
import { createHash, randomBytes, randomInt } from "crypto";
import { Vonage } from "@vonage/server-sdk";
import { Channels } from "@vonage/messages";
import QRCode from "qrcode";
import { getProductById } from "./products.js";

const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  VONAGE_API_KEY,
  VONAGE_API_SECRET,
  VONAGE_FROM_NUMBER,
  OWNER_PHONE_NUMBER,
  DATABASE_URL,
  RESEND_API_KEY,
  EMAIL_FROM,
  FRONTEND_URL, // např. https://prima-lahudky.cz  (bez lomítka na konci)
  PORT = 3001,
} = process.env;

for (const [key, val] of Object.entries({
  VONAGE_API_KEY,
  VONAGE_API_SECRET,
  VONAGE_FROM_NUMBER,
  OWNER_PHONE_NUMBER,
  DATABASE_URL,
  FRONTEND_URL,
})) {
  if (!val) throw new Error(`Chybí proměnná prostředí: ${key} (nastav ji v .env)`);
}

const frontendUrl = new URL(FRONTEND_URL.includes("://") ? FRONTEND_URL : `https://${FRONTEND_URL}`);
if (frontendUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(frontendUrl.hostname)) {
  throw new Error("FRONTEND_URL musí používat HTTPS.");
}
const FRONTEND_ORIGIN = frontendUrl.origin;

// Stripe is optional while card payments are disabled on the storefront.
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const vonage = new Vonage({
  apiKey: VONAGE_API_KEY,
  apiSecret: VONAGE_API_SECRET,
});
const db = new Pool({ connectionString: DATABASE_URL });
const BANK_ACCOUNT_HOLDER = "Martina Dupáková";
const BANK_ACCOUNT = "229310381/0300";
const BANK_IBAN = "CZ7203000000000229310381";

await db.query(`CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  confirmation_token_hash TEXT NOT NULL UNIQUE,
  confirmation_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'confirmed')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  payment_method TEXT NOT NULL,
  store_payment_method TEXT,
  items JSONB NOT NULL,
  total_czk INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
)`);

const app = express();
// Render terminates TLS at one trusted reverse proxy; this gives rate limits
// the client's address instead of the shared proxy address.
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN }));

const orderRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Bylo odesláno příliš mnoho objednávek. Zkuste to prosím za chvíli." },
});
const confirmationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Příliš mnoho pokusů o potvrzení. Zkuste to prosím za chvíli." },
});

// --- WEBHOOK route MUSÍ mít raw body (kvůli ověření podpisu) a MUSÍ být
// registrovaná PŘED express.json(), jinak Stripe podpis neověříš. ---
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(503).send("Stripe payments are not configured.");
    }
    let event;
    try {
      const signature = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Neplatný Stripe webhook podpis:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      try {
        await sendOrderSms(session);
      } catch (err) {
        console.error("Nepodařilo se odeslat SMS:", err);
        // Neúspěšné doručení necháme Stripe zopakovat podle jeho retry politiky.
        return res.status(500).send("SMS delivery failed");
      }
    }

    res.json({ received: true });
  }
);

// Od teď už normální JSON parsing pro ostatní routy.
app.use(express.json({ limit: "20kb" }));

app.get("/api/checkout-session/:id", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Platba kartou zatím není dostupná." });
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Neplatná platba." });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id);
    res.json({ paymentStatus: session.payment_status, requestedAt: session.metadata?.requestedAt ?? null });
  } catch (err) {
    console.error("Nepodařilo se ověřit stav platby:", err);
    res.status(404).json({ error: "Platbu se nepodařilo ověřit." });
  }
});

app.post("/api/create-checkout-session", orderRequestLimiter, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Platba kartou zatím není dostupná." });
  try {
    const { customerName, customerPhone, requestedAt, note, items } = req.body;
    const requestedTime = typeof requestedAt === "string" ? new Date(requestedAt) : null;

    if (
      typeof customerName !== "string" || customerName.trim().length < 2 || customerName.length > 120 ||
      typeof customerPhone !== "string" || customerPhone.trim().length < 9 || customerPhone.length > 40 ||
      !requestedTime || !Number.isFinite(requestedTime.getTime()) ||
      requestedTime.getTime() < Date.now() + 48 * 60 * 60 * 1000 ||
      !isStoreOpenAt(requestedTime) ||
      (note !== undefined && (typeof note !== "string" || note.length > 1000)) ||
      !Array.isArray(items) || items.length === 0 || items.length > 50
    ) {
      return res.status(400).json({ error: "Vyplňte údaje a zvolte termín alespoň 48 hodin předem během otevírací doby." });
    }
    if (items.some((item) =>
      !item || typeof item.id !== "string" || !Number.isInteger(item.quantity) ||
      item.quantity < 1 || item.quantity > 99 || !getProductById(item.id)
    )) {
      return res.status(400).json({ error: "Objednávka obsahuje neplatnou položku." });
    }

    // Ceny a názvy bereme VÝHRADNĚ ze server-side seznamu produktů (products.js),
    // nikdy z toho, co pošle klient - jinak by šlo objednávku podvrhnout.
    const line_items = items.map((item) => {
      const product = getProductById(item.id);
      const quantity = item.quantity;
      return {
        quantity,
        price_data: {
          currency: "czk",
          unit_amount: product.price * 100, // Stripe počítá v haléřích
          product_data: { name: `${product.name} (${product.unit})` },
        },
      };
    });

    // Krátké shrnutí objednávky pro SMS - Stripe metadata má limit 500 znaků na hodnotu,
    // proto to necháme stručné (pro tenhle e-shop s pár položkami to stačí).
    const itemsSummary = items
      .map((item) => {
        const product = getProductById(item.id);
        return `${product.name} x${item.quantity}`;
      })
      .join(", \n")
      .slice(0, 480);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${FRONTEND_ORIGIN}/eshop?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_ORIGIN}/eshop?payment=cancelled`,
      metadata: {
        customerName: customerName.slice(0, 480),
        customerPhone: customerPhone.slice(0, 480),
        requestedAt: requestedTime.toISOString(),
        note: (note || "").slice(0, 480),
        itemsSummary,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Chyba při vytváření checkout session:", err);
    res.status(500).json({ error: "Nepodařilo se vytvořit platbu." });
  }
});

// Objednávky placené převodem nebo při osobním převzetí ukládáme do databáze
// a nové objednávky posíláme prodejně přes SMS.
app.post("/api/create-order-request", orderRequestLimiter, async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, requestedAt, paymentMethod, storePaymentMethod, note, items } = req.body;
    const requestedTime = typeof requestedAt === "string" ? new Date(requestedAt) : null;
    if (
      typeof customerName !== "string" || customerName.trim().length < 2 || customerName.length > 120 ||
      typeof customerPhone !== "string" || customerPhone.trim().length < 9 || customerPhone.length > 40 ||
      typeof customerEmail !== "string" || customerEmail.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()) ||
      !requestedTime || !Number.isFinite(requestedTime.getTime()) ||
      requestedTime.getTime() < Date.now() + 48 * 60 * 60 * 1000 || !isStoreOpenAt(requestedTime) ||
      !["bank_transfer", "store"].includes(paymentMethod) ||
      (paymentMethod === "store" && !["cash", "card"].includes(storePaymentMethod)) ||
      (paymentMethod === "bank_transfer" && storePaymentMethod !== undefined) ||
      (note !== undefined && (typeof note !== "string" || note.length > 1000)) ||
      !Array.isArray(items) || items.length === 0 || items.length > 50 ||
      items.some((item) => !item || typeof item.id !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || !getProductById(item.id))
    ) {
      return res.status(400).json({ error: "Zkontrolujte údaje, způsob platby a termín alespoň 48 hodin předem během otevírací doby." });
    }
    if (paymentMethod === "bank_transfer" && (!RESEND_API_KEY || !EMAIL_FROM)) {
      return res.status(503).json({ error: "Potvrzovací e-maily ještě nejsou nastavené. Zkuste objednávku později nebo nám zavolejte." });
    }

    const orderItems = items.map((item) => {
      const product = getProductById(item.id);
      return { product, quantity: item.quantity };
    });
    const total = orderItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const itemsSummary = orderItems.map(({ product, quantity }) => `${product.name} x${quantity}`).join(", ");
    const requestedLabel = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "short", timeStyle: "short" }).format(requestedTime);
    const paymentLabel = paymentMethod === "bank_transfer"
      ? "Bankovní převod – čeká na potvrzení a připsání"
      : `Osobní odběr – ${storePaymentMethod === "cash" ? "hotově" : "kartou při převzetí"}`;
    const variableSymbol = String(randomInt(1_000_000_000, 10_000_000_000));
    const orderCode = `LP-${variableSymbol}`;
    const confirmationToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(confirmationToken).digest("hex");
    const savedItems = orderItems.map(({ product, quantity }) => ({ name: product.name, unit: product.unit, unitPrice: product.price, quantity }));
    await db.query(
      `INSERT INTO orders (order_code, confirmation_token_hash, confirmation_expires_at, customer_name, customer_phone, customer_email, requested_at, payment_method, store_payment_method, items, total_czk, note)
       VALUES ($1, $2, NOW() + INTERVAL '72 hours', $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
      [orderCode, tokenHash, customerName.trim(), customerPhone.trim(), customerEmail.trim(), requestedTime.toISOString(), paymentMethod, storePaymentMethod ?? null, JSON.stringify(savedItems), total, note?.trim() || null]
    );
    const confirmationUrl = `${FRONTEND_ORIGIN}/potvrdit-objednavku/${confirmationToken}`;
    const body = [
      `Nová objednávka ${orderCode}`,
      `${customerName.trim()}, tel: ${customerPhone.trim()}`,
      `Termín: ${requestedLabel}`,
      `Platba: ${paymentLabel}`,
      paymentMethod === "bank_transfer" ? `Variabilní symbol: ${variableSymbol}` : null,
      itemsSummary,
      `Celkem: ${total} Kč`,
      paymentMethod === "bank_transfer" ? `Po kontrole platby otevřete odkaz a odešlete potvrzení zákazníkovi: ${confirmationUrl}` : null,
      note?.trim() ? `Pozn.: ${note.trim()}` : null,
    ].filter(Boolean).join("\n");

    await vonage.messages.send({
      messageType: "text",
      channel: Channels.SMS,
      to: OWNER_PHONE_NUMBER.replace(/\D/g, ""),
      from: VONAGE_FROM_NUMBER.replace(/[^\da-z]/gi, ""),
      text: body,
    });
    if (paymentMethod === "bank_transfer") {
      const qrPayload = [
        "SPD*1.0",
        `ACC:${BANK_IBAN}`,
        `AM:${total.toFixed(2)}`,
        "CC:CZK",
        `X-VS:${variableSymbol}`,
        `MSG:OBJEDNAVKA ${orderCode}`,
      ].join("*");
      const qrPng = await QRCode.toBuffer(qrPayload, { type: "png", errorCorrectionLevel: "M", margin: 4, width: 360 });
      const paymentEmailText = [
        `Dobrý den, ${customerName.trim()},`, "",
        `děkujeme za objednávku ${orderCode}.`,
        "Pro dokončení bankovního převodu použijte prosím tyto údaje:",
        `Příjemce: ${BANK_ACCOUNT_HOLDER}`,
        `Číslo účtu: ${BANK_ACCOUNT}`,
        `IBAN: ${BANK_IBAN}`,
        `Částka: ${total} Kč`,
        `Variabilní symbol: ${variableSymbol}`,
        `Termín vyzvednutí: ${requestedLabel}`,
        `Objednávka: ${itemsSummary}`,
        "",
        "V příloze najdete QR kód s předvyplněnou částkou a variabilním symbolem.",
        "Objednávku a přijetí platby vám potvrdíme samostatným e-mailem po kontrole platby.",
        "",
        "Prima Lahůdky",
      ].join("\n");
      const paymentEmailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `order-payment-${orderCode}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [customerEmail.trim()],
          subject: `Platební údaje k objednávce ${orderCode} – Prima Lahůdky`,
          text: paymentEmailText,
          attachments: [{ filename: `qr-platba-${orderCode}.png`, content: qrPng.toString("base64") }],
        }),
      });
      if (!paymentEmailResponse.ok) {
        console.error("Platební e-mail se nepodařilo odeslat přes Resend:", await paymentEmailResponse.text());
        return res.status(502).json({ error: "Objednávku jsme přijali, ale e-mail s platebními údaji se nepodařilo odeslat. Zavolejte nám prosím." });
      }
    }
    res.json({ ok: true, orderCode, variableSymbol });
  } catch (err) {
    console.error("Nepodařilo se zpracovat objednávku:", err);
    res.status(500).json({ error: "Objednávku se nepodařilo odeslat. Zkuste to prosím znovu nebo nám zavolejte." });
  }
});

app.get("/api/order-confirmation/:token", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return res.status(404).json({ error: "Odkaz není platný." });
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const result = await db.query(
      `SELECT order_code, status, customer_name, customer_phone, customer_email, requested_at, payment_method, store_payment_method, items, total_czk, note, confirmation_expires_at
       FROM orders WHERE confirmation_token_hash = $1`, [tokenHash]
    );
    const order = result.rows[0];
    if (!order) return res.status(404).json({ error: "Objednávku se nepodařilo najít." });
    if (order.confirmation_expires_at <= new Date() && order.status !== "confirmed") return res.status(410).json({ error: "Odkaz vypršel. Kontaktujte prosím zákazníka přímo." });
    res.json({ order });
  } catch (err) {
    console.error("Nepodařilo se načíst objednávku:", err);
    res.status(500).json({ error: "Objednávku se nepodařilo načíst." });
  }
});

app.post("/api/order-confirmation/:token/confirm", confirmationLimiter, async (req, res) => {
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return res.status(404).json({ error: "Odkaz není platný." });
  if (!RESEND_API_KEY || !EMAIL_FROM) return res.status(503).json({ error: "Odesílání e-mailů ještě není nastavené." });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const claim = await db.query(
      `UPDATE orders SET status = 'sending'
       WHERE confirmation_token_hash = $1 AND status = 'pending' AND confirmation_expires_at > NOW()
       RETURNING order_code, customer_name, customer_email, requested_at, payment_method, store_payment_method, items, total_czk, note`, [tokenHash]
    );
    const order = claim.rows[0];
    if (!order) {
      const existing = await db.query("SELECT status, confirmation_expires_at FROM orders WHERE confirmation_token_hash = $1", [tokenHash]);
      if (!existing.rows[0]) return res.status(404).json({ error: "Objednávku se nepodařilo najít." });
      if (existing.rows[0].status === "confirmed") return res.json({ ok: true, alreadyConfirmed: true });
      if (existing.rows[0].confirmation_expires_at <= new Date()) return res.status(410).json({ error: "Odkaz vypršel. Kontaktujte prosím zákazníka přímo." });
      return res.status(409).json({ error: "Potvrzení této objednávky se právě zpracovává." });
    }
    if (order.payment_method !== "bank_transfer") {
      await db.query("UPDATE orders SET status = 'pending' WHERE confirmation_token_hash = $1", [tokenHash]);
      return res.status(400).json({ error: "Tento odkaz není určený pro potvrzení bankovního převodu." });
    }
    const requestedLabel = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "full", timeStyle: "short" }).format(order.requested_at);
    const itemLines = order.items.map((item) => `${item.name} × ${item.quantity} — ${item.unitPrice * item.quantity} Kč`).join("\n");
    const emailText = [
      `Dobrý den, ${order.customer_name},`, "",
      `potvrzujeme objednávku ${order.order_code} a přijetí platby.`,
      `Termín vyzvednutí: ${requestedLabel}`, "", "Objednávka:", itemLines,
      "", `Celkem: ${order.total_czk} Kč`, "",
      "Děkujeme za objednávku, Prima Lahůdky",
      order.note ? `\nVaše poznámka: ${order.note}` : null,
    ].filter(Boolean).join("\n");
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `order-confirmation-${order.order_code}` },
      body: JSON.stringify({ from: EMAIL_FROM, to: [order.customer_email], subject: `Potvrzení objednávky ${order.order_code} – Prima Lahůdky`, text: emailText }),
    });
    if (!emailResponse.ok) {
      console.error("E-mail se nepodařilo odeslat přes Resend:", await emailResponse.text());
      await db.query("UPDATE orders SET status = 'pending' WHERE confirmation_token_hash = $1", [tokenHash]);
      return res.status(502).json({ error: "E-mail se nepodařilo odeslat. Zkuste to prosím znovu." });
    }
    await db.query("UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE confirmation_token_hash = $1 AND status = 'sending'", [tokenHash]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Nepodařilo se potvrdit objednávku:", err);
    await db.query("UPDATE orders SET status = 'pending' WHERE confirmation_token_hash = $1 AND status = 'sending'", [tokenHash]).catch((resetError) => {
      console.error("Nepodařilo se obnovit stav potvrzení objednávky:", resetError);
    });
    res.status(500).json({ error: "Potvrzení objednávky se nepodařilo dokončit." });
  }
});

function isStoreOpenAt(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  if (values.second !== "00" || date.getUTCMilliseconds() !== 0) return false;
  const minuteOfDay = Number(values.hour) * 60 + Number(values.minute);
  if (values.weekday === "Sun") return false;
  if (values.weekday === "Sat") return minuteOfDay === 9 * 60;
  return minuteOfDay >= 6 * 60 + 30 && minuteOfDay < 17 * 60 && (minuteOfDay - (6 * 60 + 30)) % 30 === 0;
}

async function sendOrderSms(session) {
  const { customerName: formCustomerName, customerPhone, requestedAt, note, itemsSummary } = session.metadata ?? {};
  if (session.payment_status !== "paid") return;
  // Pokud zákazník doplnil jméno až na Stripe Checkoutu, použijeme tuhle novější hodnotu.
  const customerName = session.customer_details?.name?.trim() || formCustomerName || "Jméno neuvedeno";
  const total = ((session.amount_total ?? 0) / 100).toFixed(0);
  const requestedDate = requestedAt ? new Date(requestedAt) : null;
  const requestedLabel = requestedDate && Number.isFinite(requestedDate.getTime())
    ? new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "short", timeStyle: "short" }).format(requestedDate)
    : "Neuveden";

  const body = [
    "🛒 Nová ZAPLACENÁ objednávka",
    `${customerName}, tel: ${customerPhone}`,
    `Požadovaný termín: ${requestedLabel}`,
    itemsSummary,
    `Celkem: ${total} Kč`,
    note ? `Pozn.: ${note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await vonage.messages.send({
    messageType: "text",
    channel: Channels.SMS,
    to: OWNER_PHONE_NUMBER.replace(/\D/g, ""),
    from: VONAGE_FROM_NUMBER.replace(/[^\da-z]/gi, ""),
    text: body,
  });
}

app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});
