/**
 * @attwork LINE Flex Menu Worker (new system)
 * Cloudflare Worker entry point.
 * Required Worker variables/secrets:
 *   LINE_CHANNEL_SECRET
 *   LINE_CHANNEL_ACCESS_TOKEN
 *   ATWORK_SCRIPT_URL
 *   ATWORK_WORKER_SHARED_SECRET
 *   ATWORK_CANDIDATE_LIFF_URL
 */

const FLEX_MENU = {
  type: "flex",
  altText: "ATWORK | เมนูสมัครงานและบริการ",
  contents: {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      spacing: "md",
      backgroundColor: "#FFFFFF",
      contents: [
        {
          type: "text",
          text: "ATWORK",
          weight: "bold",
          size: "xl",
          color: "#173B65"
        },
        {
          type: "text",
          text: "เมนูหลัก",
          size: "sm",
          color: "#667085",
          margin: "xs"
        },
        { type: "separator", margin: "md", color: "#DCE5F0" },
        {
          type: "button",
          style: "primary",
          color: "#173B65",
          height: "md",
          action: {
            type: "uri",
            label: "ฝาก Resume / สมัครงาน",
            uri: "__ATWORK_CANDIDATE_LIFF_URL__"
          }
        },
        {
          type: "button",
          style: "primary",
          color: "#2869B2",
          height: "md",
          action: {
            type: "postback",
            label: "ตรวจสอบสถานะ",
            data: "action=status",
            displayText: "ตรวจสอบสถานะ"
          }
        },
        {
          type: "button",
          style: "secondary",
          height: "md",
          action: {
            type: "postback",
            label: "ตำแหน่งงานที่เปิดรับ",
            data: "action=jobs",
            displayText: "ตำแหน่งงานที่เปิดรับ"
          }
        }
      ]
    }
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        success: true,
        service: "ATWORK LINE Webhook",
        status: "OK",
        version: "new-flex-menu-v1"
      });
    }

    if (request.method !== "POST") {
      return json({ success: false, message: "Method Not Allowed" }, 405);
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature") || "";
    const valid = await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET);
    if (!valid) {
      return json({ success: false, message: "Invalid LINE signature" }, 401);
    }

    let body;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch (_) {
      return json({ success: false, message: "Invalid JSON" }, 400);
    }

    const events = Array.isArray(body.events) ? body.events : [];
    // LINE expects a quick response; event handling still waits here to capture errors in logs.
    for (const event of events) {
      try {
        await handleLineEvent(event, env);
      } catch (error) {
        console.error("ATWORK event error:", error && error.stack ? error.stack : String(error));
      }
    }

    return json({ success: true });
  }
};

async function handleLineEvent(event, env) {
  if (!event || !event.replyToken) return;

  if (event.type === "follow") {
    await replyLine(env, event.replyToken, [buildFlexMenu(env)]);
    return;
  }

  if (event.type === "postback") {
    const params = new URLSearchParams(String(event.postback && event.postback.data || ""));
    const action = params.get("action");
    const lineUserId = String(event.source && event.source.userId || "");
    if (!lineUserId) {
      await replyLine(env, event.replyToken, [{ type: "text", text: "ไม่พบ LINE User ID กรุณาเปิดแชตกับ ATWORK แล้วลองอีกครั้ง" }]);
      return;
    }

    if (action === "status") {
      const result = await callAppsScript(env, "workerGetStatus", { lineUserId });
      await replyLine(env, event.replyToken, [{ type: "text", text: formatStatus(result) }]);
      return;
    }

    if (action === "jobs") {
      const result = await callAppsScript(env, "workerGetJobs", {});
      await replyLine(env, event.replyToken, [{ type: "text", text: formatJobs(result) }]);
      return;
    }

    await replyLine(env, event.replyToken, [buildFlexMenu(env)]);
    return;
  }

  if (event.type === "message" && event.message && event.message.type === "text") {
    const text = normalizeText(event.message.text);
    const lineUserId = String(event.source && event.source.userId || "");

    if (["menu", "เมนู", "เริ่ม", "เริ่มต้น", "สวัสดี", "สมัครงาน", "ฝาก resume", "ฝากresume"].includes(text)) {
      await replyLine(env, event.replyToken, [buildFlexMenu(env)]);
      return;
    }
    if (["สถานะ", "ตรวจสอบสถานะ", "เช็คสถานะ", "เช็กสถานะ", "สถานะการสมัคร"].includes(text)) {
      const result = await callAppsScript(env, "workerGetStatus", { lineUserId });
      await replyLine(env, event.replyToken, [{ type: "text", text: formatStatus(result) }]);
      return;
    }
    if (["ตำแหน่งงาน", "ตำแหน่งงานที่เปิดรับ", "งานที่เปิดรับ", "งานว่าง"].includes(text)) {
      const result = await callAppsScript(env, "workerGetJobs", {});
      await replyLine(env, event.replyToken, [{ type: "text", text: formatJobs(result) }]);
      return;
    }
  }
}

function buildFlexMenu(env) {
  const candidateUrl = String(env.ATWORK_CANDIDATE_LIFF_URL || "").trim();
  if (!candidateUrl || !/^https:\/\/liff\.line\.me\//i.test(candidateUrl)) {
    throw new Error("กรุณาตั้งค่า ATWORK_CANDIDATE_LIFF_URL ให้เป็น LIFF URL ของแบบฟอร์มผู้สมัครงานชุดใหม่");
  }
  const flex = JSON.parse(JSON.stringify(FLEX_MENU));
  flex.contents.body.contents.forEach((item) => {
    if (item && item.type === "button" && item.action && item.action.type === "uri") {
      item.action.uri = candidateUrl;
    }
  });
  return flex;
}

async function callAppsScript(env, action, fields) {
  const endpoint = String(env.ATWORK_SCRIPT_URL || "").trim();
  const sharedSecret = String(env.ATWORK_WORKER_SHARED_SECRET || "");
  if (!endpoint) throw new Error("ยังไม่ได้ตั้งค่า ATWORK_SCRIPT_URL");
  if (!sharedSecret) throw new Error("ยังไม่ได้ตั้งค่า ATWORK_WORKER_SHARED_SECRET");

  const form = new URLSearchParams({ action, secret: sharedSecret });
  Object.entries(fields || {}).forEach(([key, value]) => form.set(key, String(value == null ? "" : value)));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form.toString(),
    redirect: "follow"
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch (_) {
    throw new Error("Apps Script ตอบกลับไม่ใช่ JSON (HTTP " + response.status + ")");
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || ("Apps Script HTTP " + response.status));
  }
  return data;
}

function formatStatus(result) {
  if (!result || result.success === false) {
    return "ขออภัย ขณะนี้ตรวจสอบสถานะไม่ได้ กรุณาลองใหม่ภายหลัง หรือติดต่อเจ้าหน้าที่ ATWORK";
  }
  if (!result.found) {
    return "ยังไม่พบข้อมูลผู้สมัครที่เชื่อมกับบัญชี LINE นี้\n\nกด “ฝาก Resume / สมัครงาน” เพื่อกรอกข้อมูลผู้สมัครก่อนครับ";
  }
  const lines = ["สถานะผู้สมัคร ATWORK"];
  if (result.expectedPosition) lines.push("ตำแหน่งที่สนใจ: " + result.expectedPosition);
  lines.push("สถานะผู้สมัคร: " + (result.candidateStatus || "-"));
  lines.push("สถานะ Resume: " + (result.resumeStatus || "-"));
  return lines.join("\n");
}

function formatJobs(result) {
  if (!result || result.success === false) {
    return "ขออภัย ขณะนี้โหลดตำแหน่งงานไม่ได้ กรุณาลองใหม่ภายหลัง";
  }
  const jobs = Array.isArray(result.jobs) ? result.jobs : [];
  if (!jobs.length) return "ขณะนี้ยังไม่มีตำแหน่งงานที่เปิดรับ\n\nกรุณาตรวจสอบใหม่ภายหลัง หรือสอบถามเจ้าหน้าที่ ATWORK";
  const lines = ["ตำแหน่งงานที่เปิดรับกับ ATWORK", ""];
  jobs.slice(0, 15).forEach((job, index) => {
    lines.push((index + 1) + ". " + String(job.title || "ไม่ระบุตำแหน่ง"));
  });
  if (jobs.length > 15) lines.push("…และอีก " + (jobs.length - 15) + " ตำแหน่ง");
  lines.push("", "กด “ฝาก Resume / สมัครงาน” เพื่อส่งข้อมูลผู้สมัคร");
  return lines.join("\n");
}

async function replyLine(env, replyToken, messages) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN");
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + env.LINE_CHANNEL_ACCESS_TOKEN
    },
    body: JSON.stringify({ replyToken, messages })
  });
  const text = await response.text();
  if (!response.ok) throw new Error("LINE Reply API HTTP " + response.status + ": " + text);
}

async function verifyLineSignature(body, signature, channelSecret) {
  if (!channelSecret || !signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(channelSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("th-TH").replace(/\s+/g, " ");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

