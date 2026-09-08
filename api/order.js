function json(response, status, body) {
  response.status(status).json(body);
}

function clean(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePhone(phone) {
  return clean(phone, 32).replace(/[^\d+]/g, "");
}

// PHP serialize для products
function phpSerializeProducts(products) {
  const phpString = (value) => {
    const str = String(value);
    return `s:${Buffer.byteLength(str, "utf8")}:"${str}";`;
  };

  const serializeArray = (arr) => {
    let result = `a:${arr.length}:{`;

    arr.forEach((item, index) => {
      result += `i:${index};`;

      if (Array.isArray(item)) {
        result += serializeArray(item);
      } else {
        const keys = Object.keys(item);

        result += `a:${keys.length}:{`;

        for (const key of keys) {
          result += phpString(key);
          const value = item[key];

          if (Array.isArray(value)) {
            result += serializeArray(value);
          } else {
            result += phpString(value);
          }
        }

        result += "}";
      }
    });

    result += "}";
    return result;
  };

  return encodeURIComponent(serializeArray(products));
}

function buildLeadMessage({ name, phone, page, source }) {
  return [
    "Нова заявка VacuGo",
    `ПІБ: ${name}`,
    `Телефон: ${phone}`,
    "Товар: VacuGo мініпилосос 2-в-1",
    "Ціна: 699 грн",
    `Джерело: ${source || "Прямий перехід"}`,
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
    json(response, 405, {
      ok: false,
      error: "Method not allowed"
    });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const lpcrmKey = process.env.LPCRM_API_KEY;
  const lpcrmProductId = process.env.LPCRM_PRODUCT_ID;

  if (!token || !chatId) {
    json(response, 500, {
      ok: false,
      error: "Telegram is not configured"
    });
    return;
  }

  if (!lpcrmKey || !lpcrmProductId) {
    json(response, 500, {
      ok: false,
      error: "LP-CRM is not configured"
    });
    return;
  }

  const body = request.body || {};

  const name = clean(body.name);
  const phone = normalizePhone(body.phone);
  const page = clean(body.page, 500);
  const source = clean(body.source, 100) || "Прямий перехід";

  if (name.length < 2) {
    json(response, 400, {
      ok: false,
      error: "Name is required"
    });
    return;
  }

  if (phone.replace(/\D/g, "").length < 10) {
    json(response, 400, {
      ok: false,
      error: "Phone is invalid"
    });
    return;
  }

  // Унікальний номер замовлення
  const orderId = `VacuGo-${Date.now()}`;

  // Товар LP-CRM
  const products = [
    {
      product_id: lpcrmProductId,
      price: "699",
      count: "1",
      subs: []
    }
  ];

  // Відправка в LP-CRM
  const lpcrmData = new URLSearchParams();

  lpcrmData.append("key", lpcrmKey);
  lpcrmData.append("order_id", orderId);
  lpcrmData.append("country", "UA");
  lpcrmData.append(
    "products",
    phpSerializeProducts(products)
  );
  lpcrmData.append("bayer_name", name);
  lpcrmData.append("phone", phone);

  // Саме цей сайт
  lpcrmData.append(
    "site",
    "https://vacugo.cmoval.store"
  );

  // Тільки джерело
  lpcrmData.append("utm_source", source);

  const lpcrmResponse = await fetch(
    "https://radiopark.lp-crm.biz/api/addNewOrder.html",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: lpcrmData.toString()
    }
  );

  if (!lpcrmResponse.ok) {
    const errorText = await lpcrmResponse.text();

    console.error("LP-CRM error:", errorText);

    json(response, 502, {
      ok: false,
      error: "LP-CRM request failed"
    });
    return;
  }

  // Відправка в Telegram
  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildLeadMessage({
          name,
          phone,
          page,
          source
        })
      })
    }
  );

  if (!telegramResponse.ok) {
    json(response, 502, {
      ok: false,
      error: "Telegram request failed"
    });
    return;
  }

  json(response, 200, {
    ok: true,
    order_id: orderId
  });
};
