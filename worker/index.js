const FLEX_MESSAGE = {
  type: "flex",
  altText: "ยินดีต้อนรับสู่ ATWORK ระบบสมัครงานออนไลน์",
  contents: {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1749A2",
      paddingAll: "20px",
      contents: [
        {
          type: "text",
          text: "ATWORK",
          color: "#FFFFFF",
          weight: "bold",
          size: "xl"
        },
        {
          type: "text",
          text: "ระบบสมัครงานออนไลน์",
          color: "#DCEBFF",
          size: "sm",
          margin: "sm"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "20px",
      contents: [
        {
          type: "text",
          text: "ยินดีต้อนรับ 👋",
          weight: "bold",
          size: "xl",
          wrap: true
        },
        {
          type: "text",
          text: "คุณต้องการทำรายการใด?",
          size: "md",
          color: "#666666",
          wrap: true
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "20px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1749A2",
          action: {
            type: "uri",
            label: "สมัครงาน",
            uri: "https://kppst.github.io/-attwork/candidate.html"
          }
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "uri",
            label: "ตรวจสอบสถานะ",
            uri: "https://kppst.github.io/-attwork/Status.html"
          }
        }
      ]
    }
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return Response.json({
        app: "ATWORK",
        status: "online"
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }

    const body = await request.text();
    const signature =
      request.headers.get("x-line-signature");

    const valid = await verifySignature(
      body,
      signature,
      env.LINE_CHANNEL_SECRET
    );

    if (!valid) {
      return new Response("Unauthorized", {
        status: 401
      });
    }

    let data;

    try {
      data = JSON.parse(body);
    } catch {
      return new Response("Bad Request", {
        status: 400
      });
    }

    // LINE ส่ง Verify webhook โดยมี events เป็น array ว่างได้
    for (const event of data.events || []) {
      if (
        event.type !== "message" ||
        event.message?.type !== "text" ||
        !event.replyToken
      ) {
        continue;
      }

      try {
        const response = await fetch(
          "https://api.line.me/v2/bot/message/reply",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization":
                `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [FLEX_MESSAGE]
            })
          }
        );

        if (!response.ok) {
          console.error(
            "LINE Reply API failed:",
            response.status,
            await response.text()
          );
        }
      } catch (error) {
        console.error("LINE request failed:", error);
      }
    }

    return new Response("OK", { status: 200 });
  }
};

async function verifySignature(
  body,
  signature,
  secret
) {
  if (!signature || !secret) return false;

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const result = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );

  const bytes = new Uint8Array(result);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const expected = btoa(binary);

  if (expected.length !== signature.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < expected.length; i++) {
    difference |=
      expected.charCodeAt(i) ^
      signature.charCodeAt(i);
  }

  return difference === 0;
}
