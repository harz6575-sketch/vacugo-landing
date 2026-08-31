const TELEGRAM_CONFIG = {
  botToken: "",
  chatId: "",
  proxyUrl: "/api/order"
};

const countdownNodes = document.querySelectorAll("[data-countdown]");
const orderForm = document.getElementById("orderForm");
const statusNode = document.getElementById("formStatus");
const submitButton = orderForm?.querySelector("[data-submit]");

function getTodayDeadline() {
  const deadline = new Date();
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

function formatTimeLeft(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function renderCountdown() {
  const timeLeft = getTodayDeadline().getTime() - Date.now();
  countdownNodes.forEach((node) => {
    node.textContent = formatTimeLeft(timeLeft);
  });
}

function setStatus(type, message) {
  if (!statusNode) return;
  statusNode.hidden = false;
  statusNode.className = `form-status ${type}`;
  statusNode.textContent = message;
}

function setLoading(isLoading) {
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading
    ? "Відправляємо заявку..."
    : "Залишити заявку за 699 грн";
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function buildLeadMessage(data) {
  const lines = [
    "Нова заявка VacuGo",
    `ПІБ: ${data.name}`,
    `Телефон: ${data.phone}`,
    "Товар: VacuGo мініпилосос 2-в-1",
    "Ціна: 699 грн",
    `Сторінка: ${window.location.href}`
  ];

  return lines.join("\n");
}

async function sendLeadToTelegram(data, message) {
  const payload = {
    chat_id: TELEGRAM_CONFIG.chatId,
    text: message
  };

  if (TELEGRAM_CONFIG.proxyUrl) {
    const response = await fetch(TELEGRAM_CONFIG.proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        page: window.location.href
      })
    });

    if (!response.ok) throw new Error("Proxy request failed");
    return response;
  }

  if (!TELEGRAM_CONFIG.botToken || !TELEGRAM_CONFIG.chatId) {
    throw new Error("Telegram is not configured");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) throw new Error("Telegram request failed");
  return response;
}

renderCountdown();
setInterval(renderCountdown, 1000);

orderForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(orderForm);
  const data = Object.fromEntries(formData.entries());
  data.name = String(data.name || "").trim();
  data.phone = normalizePhone(String(data.phone || ""));

  if (data.name.length < 2) {
    setStatus("error", "Вкажіть, будь ласка, ПІБ.");
    return;
  }

  if (data.phone.replace(/\D/g, "").length < 10) {
    setStatus("error", "Вкажіть коректний номер телефону.");
    return;
  }

  const message = buildLeadMessage(data);
  setLoading(true);
  setStatus("pending", "Заявку прийнято, відправляємо її менеджеру.");

  try {
    await sendLeadToTelegram(data, message);
    setStatus("success", "Дякуємо! Заявку відправлено. Менеджер скоро зв'яжеться з вами.");
    orderForm.reset();
  } catch (error) {
    console.warn("Telegram lead fallback:", error.message, data);
    setStatus(
      "success",
      "Форма спрацювала в демо-режимі. Додайте BOT_TOKEN і CHAT_ID у script.js, щоб заявки йшли в Telegram."
    );
  } finally {
    setLoading(false);
    statusNode?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

