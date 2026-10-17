const FLEX_MESSAGE = {
  type: "flex",
  altText: "@ATTWORK เมนูสำหรับผู้หางาน",
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
          text: "สำหรับผู้หางาน",
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
          text: "ยินดีต้อนรับผู้หางาน 👋",
          weight: "bold",
          size: "xl",
          wrap: true
        },
        {
          type: "text",
          text: "เลือกบริการที่ต้องการใช้งาน",
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
          style: "secondary",
          action: {
            type: "postback",
            label: "ตำแหน่งงานที่เปิดรับ",
            data: "action=under_construction&menu=view_jobs"
          }
        },
        {
          type: "button",
          style: "primary",
          action: {
            type: "uri",
            label: "สมัครงาน,สร้าง RESUME",
            uri: "https://kppst.github.io/-attwork/candidate.html"
          }
        },
        {
          type: "button",
          style: "primary",
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
          text: "เลือกบริการสำหรับบริษัทผู้รับสมัครงาน",
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
          action: {
            type: "uri",
            label: "แจ้งความต้องการบุคลากร",
            uri: "https://kppst.github.io/-attwork/"
          }
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "postback",
            label: "ขอใบเสนอราคา",
            data: "action=under_construction&menu=quotation"
          }
        }
      ]
    }
  }
};


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ตรวจสอบสถานะ Worker ผ่าน GET
    if (request.method === "GET") {
      return Response.json({
        app: "ATTWORK",
        status: "online"
      });
    }

    // อนุญาตเฉพาะ GET และ POST
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }

    // อ่าน body ต้นฉบับเพื่อใช้ตรวจสอบ Signature
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

    // ประมวลผลเหตุการณ์จาก LINE
    for (const event of data.events || []) {
      if (!event.replyToken) continue;

      let messages = null;

      // Flex Message จะแสดงเมื่อกด Rich Menu แบบ Postback
      
      // รองรับ Rich Menu แบบ Postback และ Message
      if (
        event.type === "postback" &&
        event.postback?.data
      ) {
        const params = new URLSearchParams(
          event.postback.data
        );

        const action = params.get("action");

        // เปิด Flex Message ตามฝั่งที่เลือก
        if (action === "open_menu") {
          const role = params.get("role");

          if (role === "jobseeker") {
            messages = [FLEX_MESSAGE];
          } else if (role === "employer") {
            messages = [FLEX_EMPLOYER];
          }
        }

        // เมนูที่กำลังปรับปรุงระบบ
        if (action === "under_construction") {
          const menuNames = {
            view_jobs: "ตำแหน่งงานที่เปิดรับ",
            quotation: "ขอใบเสนอราคา",
          };

          const menuName =
            menuNames[params.get("menu")] || "เมนูนี้";

          messages = [
            {
              type: "text",
              text:
                `🚧 กำลังปรับปรุงระบบ 🚧

              ปุ่ม: ${menuName}
              สถานะ: กำลังปรับปรุง

              ขออภัยในความไม่สะดวก
              กรุณากลับมาใช้บริการอีกครั้งภายหลัง`
            }
          ];
        }
      } else if (
        event.type === "message" &&
        event.message?.type === "text"
      ) {
        const text = event.message.text.trim();

        // Rich Menu ฝั่งผู้หางาน
        if (text === "เมนูผู้หางาน") {
          messages = [FLEX_MESSAGE];
        }

        // Rich Menu ฝั่งบริษัท
        else if (text === "เมนูบริษัท") {
          messages = [FLEX_EMPLOYER];
        }
      }

      // ไม่ส่งข้อความ หากไม่ได้กดคำสั่งที่รองรับ
      if (!messages) continue;

      // ส่งข้อความตอบกลับผ่าน LINE Reply API
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

    // ตอบกลับ LINE Webhook
    return new Response("OK", {
      status: 200
    });
  }
};


// ตรวจสอบลายเซ็นจาก LINE
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
