function json(response, status, body) {
  response.status(status).json(body);
}

function clean(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePhone(phone) {
  return clean(phone, 32).replace(/[^\d+]/g, "");
}

function buildLeadMessage({ name, phone, page }) {
  return [
    "Нова заявка VacuGo",
    `ПІБ: ${name}`,
    `Телефон: ${phone}`,
    "Товар: VacuGo мініпилосос 2-в-1",
    "Ціна: 699 грн",
    `Сторінка: ${page || "не вказано"}`
  ].join("\n");
}

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    json(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    json(response, 500, { ok: false, error: "Telegram is not configured" });
    return;
  }

  const body = request.body || {};
  const name = clean(body.name);
  const phone = normalizePhone(body.phone);
  const page = clean(body.page, 500);

  if (name.length < 2) {
    json(response, 400, { ok: false, error: "Name is required" });
    return;
  }

  if (phone.replace(/\D/g, "").length < 10) {
    json(response, 400, { ok: false, error: "Phone is invalid" });
    return;
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildLeadMessage({ name, phone, page })
    })
  });

  if (!telegramResponse.ok) {
    json(response, 502, { ok: false, error: "Telegram request failed" });
    return;
  }

  json(response, 200, { ok: true });
};
