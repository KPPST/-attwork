const FLEX_EMPLOYER = {
  type: "flex",
  altText: "@ATTWORK เมนูสำหรับบริษัท",
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
          text: "@ATTWORK",
          color: "#FFFFFF",
          weight: "bold",
          size: "xl"
        },
        {
          type: "text",
          text: "สำหรับบริษัทผู้รับสมัครงาน",
          color: "#DCEBFF",
          size: "sm",
          margin: "sm",
          wrap: true
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
          text: "ยินดีต้อนรับบริษัท 👋",
          weight: "bold",
          size: "xl",
          wrap: true
        },
        {
          type: "text",
          text: "เลือกบริการสำหรับผู้หาสมัครงาน",
          size: "sm",
          color: "#666666",
          wrap: true
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "20px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1749A2",
          action: {
            type: "postback",
            label: "ดูตำแหน่งงานว่าง",
            data: "action=under_construction&menu=View_Jobs"
          }
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "postback",
            label: "จัดการตำแหน่งงาน",
            data: "action=under_construction&menu=View_Jobs"
          }
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "postback",
            label: "ดูรายชื่อผู้สมัคร",
            data: "action=under_construction&menu=applicants"
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
  if (!event.replyToken) continue;

  let messages = null;

  // กรณีกดปุ่มแบบ Postback
  if (event.type === "postback") {
    const params = new URLSearchParams(
      event.postback?.data || ""
    );

    const action = params.get("action");

    // เปิด Flex ตามฝั่งที่เลือก
    if (action === "open_menu") {
      const role = params.get("role");

      if (role === "jobseeker") {
        messages = [FLEX_MESSAGE];
      } else if (role === "employer") {
        messages = [FLEX_EMPLOYER];
      }
    }

    // เมนูที่ยังพัฒนาไม่เสร็จ
    if (action === "under_construction") {
      const menuNames = {
        job_posting: "ประกาศรับสมัครงาน",
    
      };

      const menuName =
        menuNames[params.get("menu")] || "เมนูนี้";

      messages = [
        {
          type: "text",
          text:
            `${menuName} กำลังปรับปรุงระบบ 🚧\n\n` +
            "ขออภัยในความไม่สะดวก " +
            "กรุณากลับมาใช้บริการอีกครั้งภายหลัง"
        }
      ];
    }
  }

  // รองรับ Rich Menu ที่ตั้ง Action เป็น Message ด้วย
  else if (
    event.type === "message" &&
    event.message?.type === "text"
  ) {
    const text = event.message.text.trim();

    if (
      [
        "ATWORK_JOBSEEKER_MENU",
        "เมนูผู้หางาน"
      ].includes(text)
    ) {
      messages = [FLEX_MESSAGE];
    } else if (
      [
        "ATWORK_EMPLOYER_MENU",
        "เมนูบริษัท"
      ].includes(text)
    ) {
      messages = [FLEX_EMPLOYER];
    }
  }
  // ข้อความอื่นที่ไม่ใช่คำสั่งจาก Rich Menu จะไม่เรียก Flex
  if (!messages) continue;

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
          messages
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
