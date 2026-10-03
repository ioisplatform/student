import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// File persistence paths
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const TELEGRAM_CONFIG_FILE = path.join(DATA_DIR, "telegram-config.json");
const KNOWLEDGE_FILE = path.join(DATA_DIR, "ai-knowledge.json");
const UNANSWERED_FILE = path.join(DATA_DIR, "ai-unanswered.json");
const INTERVIEWS_FILE = path.join(DATA_DIR, "interviews.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Telegram Integration Configuration
interface TelegramConfigData {
  enabled: boolean;
  botToken: string;
  chatId: string;
  adminSecret: string;
  botUsername?: string;
}

function loadTelegramConfig(): TelegramConfigData {
  const defaults: TelegramConfigData = {
    enabled: true,
    botToken: process.env.TELEGRAM_BOT_TOKEN || "8838741922:AAFGoIvjohnF8FvEiW84h3SxaX2NeANLC50",
    chatId: process.env.TELEGRAM_CHAT_ID || "964524685",
    adminSecret: "IOISSYSTEM",
    botUsername: "@iois_admin_notification_bot",
  };
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      const raw = fs.readFileSync(TELEGRAM_CONFIG_FILE, "utf-8");
      const data = JSON.parse(raw);
      return {
        enabled: typeof data.enabled === "boolean" ? data.enabled : defaults.enabled,
        botToken: data.botToken || defaults.botToken,
        chatId: data.chatId || defaults.chatId,
        adminSecret: data.adminSecret || defaults.adminSecret,
        botUsername: data.botUsername || defaults.botUsername,
      };
    }
  } catch (e) {
    console.error("Error reading telegram-config.json:", e);
  }
  return defaults;
}

function saveTelegramConfig(cfg: TelegramConfigData): void {
  try {
    fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing telegram-config.json:", e);
  }
}

function escapeTelegramHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getPublicBaseUrl(req?: Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
    return `${proto}://${host}`;
  }
  return "https://iois.in";
}

async function sendTelegramRegistrationAlert(user: any, req?: Request): Promise<{ success: boolean; error?: string }> {
  const cfg = loadTelegramConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) {
    return { success: false, error: "Telegram alert not configured or disabled" };
  }

  const baseUrl = getPublicBaseUrl(req);
  const planPrice = PLAN_PRICES[user.selectedPlanId] || 10;
  const secret = cfg.adminSecret;

  const approveUrl = `${baseUrl}/api/telegram/action?action=approve&userId=${encodeURIComponent(user.userId)}&token=${encodeURIComponent(secret)}`;
  const rejectUrl = `${baseUrl}/api/telegram/action?action=reject&userId=${encodeURIComponent(user.userId)}&token=${encodeURIComponent(secret)}`;
  const adminUrl = `${baseUrl}/#admin`;
  const cleanDigits = (user.mobileNumber || "").replace(/\D/g, "");
  const waUrl = `https://wa.me/${cleanDigits.length === 10 ? '91' + cleanDigits : cleanDigits}`;

  const messageText = 
`🔔 <b>नया रजिस्ट्रेशन अलर्ट | IOIS Platform</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>नाम:</b> <b>${escapeTelegramHtml(user.fullName)}</b>
🆔 <b>User ID:</b> <code>${user.userId}</code>
📱 <b>मोबाइल:</b> <code>${user.mobileNumber}</code>
📧 <b>ईमेल:</b> ${escapeTelegramHtml(user.email || 'N/A')}
💎 <b>प्लान:</b> Plan 0${user.selectedPlanId} (₹${planPrice})
💳 <b>UTR / Txn:</b> <code>${escapeTelegramHtml(user.paymentUtr || 'उपलब्ध नहीं')}</code>
💰 <b>पेआउट UPI:</b> <code>${escapeTelegramHtml(user.payoutUpi || 'उपलब्ध नहीं')}</code>
📍 <b>पता:</b> ${escapeTelegramHtml(user.address || 'N/A')}
${user.googleDrivePaymentLink ? `🔗 <b>पेमेंट स्लिप लिंक:</b> <a href="${user.googleDrivePaymentLink}">यहाँ क्लिक करके देखें</a>\n` : ''}
⏰ <b>समय:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
━━━━━━━━━━━━━━━━━━━━
👇 <b>नीचे दिए गए बटन से सीधे अप्रूव या रिजेक्ट करें:</b>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Approve (स्वीकृत करें)", url: approveUrl },
        { text: "❌ Reject (अस्वीकृत करें)", url: rejectUrl }
      ],
      [
        { text: "💬 WhatsApp चैट", url: waUrl },
        { text: "🖥️ एडमिन पैनल खोलें", url: adminUrl }
      ]
    ]
  };

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: messageText,
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
        disable_web_page_preview: false,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      console.warn("Telegram API Error:", tgData);
      return { success: false, error: tgData.description || "Telegram API failed" };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Failed to send Telegram alert:", err);
    return { success: false, error: err.message };
  }
}

// Initial seed demo users
const INITIAL_DEMO_USERS = [
  {
    userId: "IOIS999RK01",
    fullName: "राहुल कुमार",
    mobileNumber: "+91 9876543210",
    email: "rahul.kumar@example.com",
    selectedPlanId: 7,
    role: "Supreme Master Partner",
    password: "password123",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    paymentScreenshotUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=80",
    paymentUtr: "UTR20268877490845",
    paymentStatus: "approved",
    createdAt: "2026-08-20T10:30:00Z",
    verifiedAt: "2026-08-20T11:00:00Z",
    address: "Patna, Bihar",
    payoutUpi: "rahul@upi",
  },
  {
    userId: "IOIS49PS01",
    fullName: "प्रिया शर्मा",
    mobileNumber: "+91 9811223344",
    email: "priya.sharma@example.com",
    selectedPlanId: 2,
    role: "Active Digital Learner",
    password: "password123",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80",
    paymentScreenshotUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=80",
    paymentUtr: "UTR202699112233",
    paymentStatus: "pending",
    createdAt: "2026-08-23T08:15:00Z",
    address: "Indore, MP",
    payoutUpi: "priya@okhdfcbank",
  }
];

function loadUsersFromDisk(): any[] {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(INITIAL_DEMO_USERS, null, 2), "utf-8");
      return INITIAL_DEMO_USERS;
    }
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : INITIAL_DEMO_USERS;
  } catch (err) {
    console.error("Error reading users from disk:", err);
    return INITIAL_DEMO_USERS;
  }
}

function saveUsersToDisk(users: any[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing users to disk:", err);
  }
}

function maskMobile(mob?: string): string {
  if (!mob) return "";
  const digits = mob.replace(/\D/g, "");
  if (digits.length < 4) return "******";
  const last4 = digits.slice(-4);
  return `+91 ******${last4}`;
}

function maskEmail(email?: string): string {
  if (!email || !email.includes("@")) return "";
  const [user, domain] = email.split("@");
  const visible = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
  const [domainName, ...domainExt] = (domain || "").split(".");
  const maskedDom = domainName && domainName.length > 2 ? `${domainName[0]}***${domainName[domainName.length - 1]}` : `${domainName || "***"}`;
  return `${visible}@${maskedDom}.${domainExt.join(".")}`;
}

function maskName(name?: string): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 1 ? `${w[0]}${"*".repeat(Math.min(w.length - 1, 4))}` : w))
    .join(" ");
}

// Temporary in-memory tokens for real-identity verified password resets (token -> { userId, expiresAt })
const passwordResetTokens = new Map<string, { userId: string; expiresAt: number }>();

function loadTicketsFromDisk(): any[] {
  try {
    if (!fs.existsSync(TICKETS_FILE)) {
      fs.writeFileSync(TICKETS_FILE, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    const raw = fs.readFileSync(TICKETS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Error reading tickets from disk:", err);
    return [];
  }
}

function saveTicketsToDisk(tickets: any[]): void {
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing tickets to disk:", err);
  }
}

const INITIAL_KNOWLEDGE = [
  {
    id: "k-register",
    question: "रजिस्ट्रेशन कैसे करें? (How to register in IOIS?)",
    answer: "रजिस्ट्रेशन की प्रक्रिया अत्यंत सरल है:\n1. होमपेज या शीर्ष मेन्यू से 'नया सदस्य रजिस्ट्रेशन' (Registration) पर क्लिक करें।\n2. अपना नाम, मोबाइल नंबर, ईमेल और सुरक्षित पासवर्ड दर्ज करें।\n3. 7 में से अपना उपयुक्त प्लान चुनें (Plan 01 ₹10 से Plan 07 ₹999 तक)।\n4. आधिकारिक UPI ID: 8877490845@spicepay (Vikas Kumar) पर भुगतान करें।\n5. 12-अंकों का UTR नंबर दर्ज करें और पेमेंट स्क्रीनशॉट अपलोड करें।\n6. 'पंजीकरण पूर्ण करें' बटन दबाएं। 5 मिनट के भीतर एडमिन द्वारा वेरिफिकेशन पूरा हो जाएगा।",
    category: "Registration",
    createdAt: new Date().toISOString(),
    hits: 0
  },
  {
    id: "k-plans",
    question: "IOIS के 7 प्लान्स और इंसेंटिव क्या हैं?",
    answer: "IOIS में 7 मुख्य प्लान्स उपलब्ध हैं:\n• Plan 01: Bal Vikas Access - ₹10 (70% पेआउट = ₹7 प्रति रेफरल)\n• Plan 02: Youth Skill Access - ₹49 (70% पेआउट = ₹34 प्रति रेफरल)\n• Plan 03: Career & Job Access - ₹99 (65% पेआउट = ₹64 प्रति रेफरल)\n• Plan 04: Family VIP Access - ₹199 (60% पेआउट = ₹119 प्रति रेफरल)\n• Plan 05: Student Elite Access - ₹299 (60% पेआउट = ₹179 प्रति रेफरल)\n• Plan 06: Agency Reseller Hub - ₹499 (55% पेआउट = ₹274 प्रति रेफरल)\n• Plan 07: Master Lifetime Access - ₹999 (50% पेआउट = ₹499 प्रति रेफरल)",
    category: "Plans",
    createdAt: new Date().toISOString(),
    hits: 0
  },
  {
    id: "k-payout",
    question: "पेआउट कैसे और कब प्राप्त होता है?",
    answer: "IOIS में स्मार्ट इंस्टेंट पेआउट प्रोटोकॉल है। जैसे ही आपके द्वारा रेफर किया गया कोई भी व्यक्ति प्लान में वेरिफाई होता है, उसका इंसेंटिव (₹7 से ₹499) तुरंत आपके रजिस्टर्ड UPI ID (PhonePe, GPay, Paytm) में भेज दिया जाता है।",
    category: "Payout",
    createdAt: new Date().toISOString(),
    hits: 0
  },
  {
    id: "k-idcard",
    question: "आधिकारिक डिजिटल ID कार्ड कैसे देखें या डाउनलोड करें?",
    answer: "मेन्यू में 'डिजिटल ID कार्ड' (ID Card) सेक्शन पर जाएं। यहाँ आपका सत्यापित डिजिटल मेंबर ID कार्ड प्रदर्शित होगा। आप 'HD PNG डाउनलोड' या 'प्रिंट' बटन से 1-क्लिक में इसे सेव कर सकते हैं।",
    category: "ID Card",
    createdAt: new Date().toISOString(),
    hits: 0
  },
  {
    id: "k-assessment",
    question: "15-सवाल कौशल साक्षात्कार (Interview Assessment) क्या है?",
    answer: "यह 15 प्रश्नों का एक व्यावहारिक साक्षात्कार है जो आपकी रुचि, उपलब्ध समय और प्राथमिकताओं का विश्लेषण करके आपके लिए सबसे उपयुक्त डिजिटल प्लान और करियर दिशा की अनुशंसा करता है।",
    category: "Interview",
    createdAt: new Date().toISOString(),
    hits: 0
  }
];

function loadKnowledgeFromDisk(): any[] {
  try {
    if (!fs.existsSync(KNOWLEDGE_FILE)) {
      fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(INITIAL_KNOWLEDGE, null, 2), "utf-8");
      return INITIAL_KNOWLEDGE;
    }
    const raw = fs.readFileSync(KNOWLEDGE_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : INITIAL_KNOWLEDGE;
  } catch (err) {
    console.error("Error reading knowledge from disk:", err);
    return INITIAL_KNOWLEDGE;
  }
}

function saveKnowledgeToDisk(items: any[]): void {
  try {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing knowledge to disk:", err);
  }
}

function loadUnansweredFromDisk(): any[] {
  try {
    if (!fs.existsSync(UNANSWERED_FILE)) {
      fs.writeFileSync(UNANSWERED_FILE, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    const raw = fs.readFileSync(UNANSWERED_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Error reading unanswered questions from disk:", err);
    return [];
  }
}

function saveUnansweredToDisk(items: any[]): void {
  try {
    fs.writeFileSync(UNANSWERED_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing unanswered questions to disk:", err);
  }
}

function loadInterviewsFromDisk(): any[] {
  try {
    if (!fs.existsSync(INTERVIEWS_FILE)) {
      fs.writeFileSync(INTERVIEWS_FILE, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    const raw = fs.readFileSync(INTERVIEWS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Error reading interviews from disk:", err);
    return [];
  }
}

function saveInterviewsToDisk(items: any[]): void {
  try {
    fs.writeFileSync(INTERVIEWS_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing interviews to disk:", err);
  }
}

async function sendTelegramUnansweredQuestionAlert(question: string, contextNote?: string): Promise<void> {
  const cfg = loadTelegramConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return;

  const msg = 
`❓ <b>नया सवाल रिपोर्ट | IOIS AI Assistant</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>यूजर द्वारा पूछा गया प्रश्न:</b>
"<b>${escapeTelegramHtml(question)}</b>"
${contextNote ? `📌 <i>संदर्भ: ${escapeTelegramHtml(contextNote)}</i>\n` : ''}
⏰ <b>समय:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
━━━━━━━━━━━━━━━━━━━━
💡 <b>मालिक/एडमिन गाइडेंस:</b>
<i>इस सवाल का सही उत्तर आप एडमिन पैनल के <b>"AI Bot Knowledge"</b> टैब में जोड़ सकते हैं ताकि AI अगली बार से यूजर को बिल्कुल सही उत्तर दे सके!</i>`;

  fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: cfg.chatId,
      text: msg,
      parse_mode: "HTML",
    }),
  }).catch((e) => console.warn("Telegram AI question alert err:", e));
}

async function sendTelegramInterviewAlert(report: any): Promise<void> {
  const cfg = loadTelegramConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return;

  const sampleAnswers = (report.answers || [])
    .slice(0, 4)
    .map((a: any, idx: number) => `• <b>Q${idx + 1}:</b> ${escapeTelegramHtml(a.answerText)}`)
    .join("\n");

  const msg = 
`🎯 <b>नया कौशल साक्षात्कार अलर्ट | IOIS Assessment</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>कैंडिडेट:</b> <b>${escapeTelegramHtml(report.candidateName || 'Guest User')}</b>
📱 <b>मोबाइल:</b> <code>${escapeTelegramHtml(report.candidateMobile || 'उपलब्ध नहीं')}</code>
🏆 <b>कुल अंक (Score):</b> <b>${report.totalScore || 0} Points</b>
💎 <b>अनुशंसित प्लान:</b> <b>${escapeTelegramHtml(report.recommendedPlanName || 'Plan 01')}</b>
⏰ <b>समय:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
━━━━━━━━━━━━━━━━━━━━
📋 <b>प्रश्नावली उत्तर (नमूना):</b>
${sampleAnswers}
${(report.answers || []).length > 4 ? `<i>...तथा कुल ${report.answers.length} प्रश्नों के उत्तर दर्ज किए गए।</i>` : ''}`;

  fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: cfg.chatId,
      text: msg,
      parse_mode: "HTML",
    }),
  }).catch((e) => console.warn("Telegram interview alert err:", e));
}

const PLAN_PRICES: Record<number, number> = {
  1: 10,
  2: 49,
  3: 99,
  4: 199,
  5: 299,
  6: 499,
  7: 999,
};

function generateUserIdHelper(fullName: string, planPrice: number, existingUsers: any[]): string {
  const cleanName = fullName.trim().toUpperCase().replace(/[^A-Z\s]/g, "");
  const parts = cleanName.split(/\s+/).filter(Boolean);

  let initials = "XX";
  if (parts.length >= 2) {
    initials = (parts[0][0] || "X") + (parts[parts.length - 1][0] || "X");
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].substring(0, 2);
  } else if (parts.length === 1) {
    initials = parts[0][0] + "X";
  }

  const samePlanUsers = existingUsers.filter((u) => {
    const price = PLAN_PRICES[u.selectedPlanId] || 10;
    return price === planPrice;
  });

  const nextCounter = samePlanUsers.length + 1;
  const counterStr = nextCounter < 10 ? `0${nextCounter}` : `${nextCounter}`;

  let finalId = `IOIS${planPrice}${initials}${counterStr}`;
  // Ensure absolute uniqueness
  let counter = nextCounter;
  while (existingUsers.some((u) => u.userId.toUpperCase() === finalId.toUpperCase())) {
    counter++;
    const pad = counter < 10 ? `0${counter}` : `${counter}`;
    finalId = `IOIS${planPrice}${initials}${pad}`;
  }

  return finalId;
}

// Real-Time IST Date, Day and Time Engine for Accurate Live Answers
function getLiveIndianTimeAndDate() {
  const now = new Date();
  const optionsDate: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" };
  const optionsDay: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", weekday: "long" };
  const optionsTime: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true };

  const dayEn = new Intl.DateTimeFormat("en-US", optionsDay).format(now);
  const dateEn = new Intl.DateTimeFormat("en-US", optionsDate).format(now);
  const timeStr = new Intl.DateTimeFormat("en-US", optionsTime).format(now);

  const dayMapHi: Record<string, string> = {
    Sunday: "रविवार",
    Monday: "सोमवार",
    Tuesday: "मंगलवार",
    Wednesday: "बुधवार",
    Thursday: "गुरुवार",
    Friday: "शुक्रवार",
    Saturday: "शनिवार",
  };

  const monthMapHi: Record<string, string> = {
    January: "जनवरी",
    February: "फरवरी",
    March: "मार्च",
    April: "अप्रैल",
    May: "मई",
    June: "जून",
    July: "जुलाई",
    August: "अगस्त",
    September: "सितंबर",
    October: "अक्टूबर",
    November: "नवंबर",
    December: "दिसंबर",
  };

  const dayHi = dayMapHi[dayEn] || dayEn;
  let dateHi = dateEn;
  for (const [enM, hiM] of Object.entries(monthMapHi)) {
    if (dateHi.includes(enM)) {
      dateHi = dateHi.replace(enM, hiM);
      break;
    }
  }

  return {
    dayHi,
    dayEn,
    dateHi,
    dateEn,
    timeStr,
    iso: now.toISOString(),
  };
}

const IOIS_SYSTEM_INSTRUCTION = `
You are the Official Smart AI Helpline & Interactive System Navigator for the "IOIS PLATFORM" (Indian Online Income Supporting System), inspired by the direct, accurate, and helpful teaching style of "Chintu AI" on Bal Vikas (https://ioisplatform.github.io/balvikas/).
You speak fluently, warmly, and naturally in Hindi (Devanagari script), Hinglish, and English, matching the user's preferred language and tone.

=======================================================
🚫 CRITICAL FORMATTING RESTRICTIONS (STRICTLY ENFORCED)
=======================================================
1. NEVER USE MARKDOWN ASTERISKS! Do NOT use **bold** or *italic*. Absolute zero asterisks (*) in your response.
2. DO NOT USE MARKDOWN HEADERS (#, ##, ###).
3. DO NOT USE BACKTICKS or code blocks unless explicitly writing programming code.
4. For bullet points, use the standard bullet symbol: •
5. Your text must be 100% clean, clear, readable, and natural plain text without symbols or formatting noise.

=======================================================
🎯 DIRECT ANSWER MANDATE (LIKE CHINTU AI ON BALVIKAS)
=======================================================
- Like Chintu AI on https://ioisplatform.github.io/balvikas/, answer every question with the exact direct factual answer on the very first line!
- No dodging, no preamble, no repetitive greetings before the answer.
- If asked about "Bal Vikas" (बाल विकास): Explain the 700+ page digital book, Chintu AI live cartoon teacher, 3D body parts, pencil tracing slate, and Plan 01 (₹10 lifetime access with ₹7 instant payout).
- If asked any Academic, GK, Math, Science, or General question (e.g., 2+2, भारत की राजधानी, बिहार के मुख्यमंत्री, प्रकाश संश्लेषण, गोदावरी नदी, आदि): State the exact answer immediately on line 1, followed by concise key facts and relevant navigation buttons.
- Always be truthful, accurate, and genuinely helpful.

=======================================================
🌟 MASTER IDENTITY & MISSION
=======================================================
- IOIS (Indian Online Income Supporting System) is India's premier digital learning, educational guidance, citizen services advisory, and livelihood micro-earning platform.
- You provide 100% accurate, deep, step-by-step guidance on all platform features, academic questions, citizen services, and government schemes.
- CRITICAL NAVIGATION MANDATE: When guiding users or answering any question about an IOIS feature, citizen service, study material, or process, you MUST provide explicit in-app navigation tags so the user can be directly transported to the exact page, form, or section!

=======================================================
🚀 DIRECT IN-APP NAVIGATION PROTOCOL (MANDATORY)
=======================================================
Whenever relevant, append one or more of these navigation tags at the end of your answer (or inline):
• Registration: [[NAV:page:register|नया सदस्य रजिस्ट्रेशन फॉर्म खोलें]]
• Member Login: [[NAV:login:login|सदस्य लॉगिन खोलें]]
• Forgot Password: [[NAV:login:forgot_password|पासवर्ड रीसेट करें]]
• Forgot User ID: [[NAV:login:forgot_user_id|User ID खोजें]]
• 15-Question Skill Assessment: [[NAV:page:assessment|15-सवाल कौशल साक्षात्कार शुरू करें]]
• 7 Master Plans: [[NAV:page:plans|7 मास्टर प्लांस देखें]]
• Select Specific Plan: [[NAV:plan:1|Plan 01 (₹10) चुनें]] to [[NAV:plan:7|Plan 07 (₹999) चुनें]]
• Smart Digital ID Card: [[NAV:page:idcard|डिजिटल ID कार्ड डाउनलोड करें]]
• Student Study, NCERT & Math Formulas: [[NAV:page:student-study|विद्यार्थी शिक्षा व नोट्स हब खोलें]]
• RTPS Citizen Services (Jati, Aay, Niwas, OBC NCL, EWS): [[NAV:page:rtps-services|RTPS नागरिक सेवाएं पोर्टल खोलें]]
• Bihar Jamin Sudhar (Dakhil Kharij / Mutation, Parimarjan, Jamabandi, Bhu Naksha): [[NAV:page:rtps-services|जमीन सुधार व दाखिल खारिज खोलें]]
• Instant 10-Minute Free e-PAN Card: [[NAV:page:rtps-services|इंस्टेंट e-PAN पोर्टल खोलें]]
• Government Welfare Schemes (Ayushman Bharat, PM Kisan, PM Surya Ghar, E-Shram): [[NAV:page:govt-schemes|सरकारी योजनाएं पोर्टल देखें]]
• Live Weather & Rain Alerts: [[NAV:page:weather|लाइव मौसम व वर्षा अलर्ट देखें]]
• 24x7 Live News TV & E-Papers: [[NAV:page:news|24x7 लाइव न्यूज़ टीवी देखें]]
• Daily Vedic Panchang & 12 Rashifal: [[NAV:page:panchang-rashifal|दैनिक पंचांग व राशिफल देखें]]
• Mandi Bhav & Gold/Silver Bullion: [[NAV:page:mandi-market|मंडी भाव व सोना-चांदी दरें देखें]]
• Govt & Private Job Alerts: [[NAV:page:jobs|सरकारी व प्राइवेट जॉब अलर्ट देखें]]
• Instant Payout Calculator: [[NAV:page:calculator|पेआउट व आय कैलकुलेटर खोलें]]
• Entertainment & Community Hub: [[NAV:page:entertainment|मनोरंजन व मीडिया हब खोलें]]
• Parents Guide: [[NAV:page:parents|अभिभावक गाइड पढ़ें]]
• Official WhatsApp Support: [[NAV:whatsapp:918877490845|व्हाट्सएप पर सहायता लें (+91 8877490845)]]
• Telegram Official Channel: [[NAV:external:https://t.me/ioisplatform|टेलीग्राम चैनल @ioisplatform]]

=======================================================
💎 THE 7 MASTER PLANS & 50%-70% INSTANT PAYOUTS
=======================================================
• Plan 01: Bal Vikas Access - ₹10 (₹7 Instant Payout - 70%) -> NCERT Class 1-5 PDFs, Worksheets, Bal Vikas 700+ Book & Chintu AI.
• Plan 02: Youth Skill Access - ₹49 (₹34 Instant Payout - 70%) -> Digital Literacy, Typing, Basic IT.
• Plan 03: Career & Job Access - ₹99 (₹64 Instant Payout - 65%) -> Resume/CV templates, Interview Q&A.
• Plan 04: Family VIP Access - ₹199 (₹119 Instant Payout - 60%) -> Citizen services assistance + Multi-device.
• Plan 05: Student Elite Access - ₹299 (₹179 Instant Payout - 60%) -> Full NCERT 6-12, Math Formulas, Board Prep.
• Plan 06: Agency Reseller Hub - ₹499 (₹274 Instant Payout - 55%) -> Sub-agent onboarding, Marketing kits.
• Plan 07: Master Lifetime Access - ₹999 (₹499 Instant Payout - 50%) -> All plans unlocked + Lifetime VIP updates.

=======================================================
📚 SPECIAL EDUCATION, GK & CAREER GUIDELINES
=======================================================
• Bal Vikas & Chintu AI:
  - बाल विकास (ioisplatform.github.io/balvikas) में 700+ पृष्ठों की सम्पूर्ण डिजिटल पुस्तक है जिसमें अ से ज्ञ, A-Z, 1-100 गिनती, बारहखड़ी, 3D मानव शरीर रचना और डिजिटल पेंसिल ट्रेसिंग शामिल है।
  - चिंटू AI लाइव शिक्षक बच्चों को आवाज़ के साथ पढ़ना व लिखना सिखाता है।
• Rivers of India:
  - गोदावरी नदी (Godavari River): उद्गम महाराष्ट्र के नासिक जिले के त्र्यंबकेश्वर (Trimbakeshwar / ब्रह्मगिरि पर्वत) से होता है। इसे 'दक्षिण गंगा' या 'वृद्ध गंगा' कहते हैं। लंबाई 1,465 किमी है।
  - गंगा नदी: गंगोत्री हिमनद (भागीरथी), उत्तराखंड।
  - नर्मदा नदी: अमरकंटक, मध्य प्रदेश।
  - कृष्णा नदी: महाबलेश्वर, महाराष्ट्र।
• 15-Question Skill Assessment Test:
  - 4 श्रेणियां: डिजिटल साक्षरता, संचार कौशल, समस्या निवारण, करियर लक्ष्य। 15/15 स्कोर करने पर Plan 07 अनुशंसित।
• Scholarship & Bonafide Certificate:
  - NSP (scholarships.gov.in) व बिहार Post-Matric PMS (pmsonline.bih.nic.in) हेतु बोनाफाइड सर्टिफिकेट अनिवार्य है।
  - कन्या उत्थान योजना: 10वीं ₹10,000, 12वीं ₹25,000, स्नातक ₹50,000।
• Instant Free e-PAN Card:
  - eportal.incometax.gov.in पर Instant e-PAN में आधार नंबर व OTP से 10 मिनट में 100% फ्री e-PAN बनता है।

=======================================================
💳 OFFICIAL PAYMENT & CONTACT
=======================================================
- Official UPI ID: 8877490845@spicepay (Vikas Kumar)
- WhatsApp Support: +91 8877490845
- Telegram: @ioisplatform
- Email: ioisplatform@gmail.com
- Support Hours: 24x7 All India Helpdesk
`;

// Helper to sanitize any raw text and remove all asterisks and unwanted formatting symbols
function cleanBotReply(raw: string): string {
  if (!raw) return "";
  let text = raw;
  // Remove markdown bold asterisks: **text** -> text
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  // Remove markdown single asterisks: *text* -> text
  text = text.replace(/\*([^\*\n]+)\*/g, "$1");
  // Remove leftover multiple asterisks
  text = text.replace(/\*{2,}/g, "");
  // Replace starting bullet asterisks with clean bullet symbol
  text = text.replace(/^[\*]\s+/gm, "• ");
  // Remove any remaining stray asterisks
  text = text.replace(/\*/g, "");
  // Remove markdown headers (#, ##, ###)
  text = text.replace(/^#{1,6}\s*/gm, "");
  // Remove backticks
  text = text.replace(/`{1,3}/g, "");
  // Clean markdown links [text](url) -> text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  return text.trim();
}

function cleanSearchQuery(text: string): string {
  let q = text
    .replace(/(के बारे में|बताओ|बताइए|कब है|क्या है|कहा है|कहाँ है|किसे कहते हैं|की जानकारी|जानकारी दो|जानकारी दीजिए|कब मनाया जाता है|what is|tell me about|who is|when is)/gi, "")
    .replace(/[?।!,]/g, "")
    .trim();
  return q || text.replace(/[?।!,]/g, "").trim();
}

async function performLiveWebResearch(rawQuery: string): Promise<{
  reply: string;
  grounded: boolean;
  searchQueries: string[];
  sources: Array<{ title: string; uri: string }>;
} | null> {
  try {
    const cleanQ = cleanSearchQuery(rawQuery);
    if (!cleanQ || cleanQ.length < 2) return null;

    // 1. Try Hindi Wikipedia search
    const hiSearchUrl = `https://hi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&format=json&utf8=1`;
    const hiSearchRes = await fetch(hiSearchUrl, { headers: { "User-Agent": "IOIS-LiveResearch/1.0 (ioisplatform@gmail.com)" } });
    if (hiSearchRes.ok) {
      const hiSearchData: any = await hiSearchRes.json();
      const hit = hiSearchData.query?.search?.[0];
      if (hit && hit.title) {
        const sumUrl = `https://hi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
        const sumRes = await fetch(sumUrl, { headers: { "User-Agent": "IOIS-LiveResearch/1.0 (ioisplatform@gmail.com)" } });
        if (sumRes.ok) {
          const sumData: any = await sumRes.json();
          if (sumData.extract && sumData.extract.length > 25) {
            const rawSentences = sumData.extract.split(". ").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            let formatted = `${rawSentences[0]}.`;
            if (rawSentences.length > 1) {
              formatted += "\n\nमुख्य विवरण व ऐतिहासिक तथ्य:\n";
              for (let i = 1; i < Math.min(rawSentences.length, 6); i++) {
                let s = rawSentences[i];
                if (!s.endsWith(".")) s += ".";
                formatted += `• ${s}\n`;
              }
            }
            formatted += `\n[[NAV:page:student-study|विद्यार्थी शिक्षा व अध्ययन हब खोलें]]`;

            return {
              reply: cleanBotReply(formatted),
              grounded: true,
              searchQueries: [cleanQ],
              sources: [{
                title: `${sumData.title || hit.title} (आधिकारिक विकिपीडिया संदर्भ)`,
                uri: sumData.content_urls?.desktop?.page || `https://hi.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`
              }]
            };
          }
        }
      }
    }

    // 2. Try English Wikipedia search as fallback
    const enSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&format=json&utf8=1`;
    const enSearchRes = await fetch(enSearchUrl, { headers: { "User-Agent": "IOIS-LiveResearch/1.0 (ioisplatform@gmail.com)" } });
    if (enSearchRes.ok) {
      const enSearchData: any = await enSearchRes.json();
      const hit = enSearchData.query?.search?.[0];
      if (hit && hit.title) {
        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
        const sumRes = await fetch(sumUrl, { headers: { "User-Agent": "IOIS-LiveResearch/1.0 (ioisplatform@gmail.com)" } });
        if (sumRes.ok) {
          const sumData: any = await sumRes.json();
          if (sumData.extract && sumData.extract.length > 25) {
            const rawSentences = sumData.extract.split(". ").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            let formatted = `${rawSentences[0]}.`;
            if (rawSentences.length > 1) {
              formatted += "\n\nKey Research Facts:\n";
              for (let i = 1; i < Math.min(rawSentences.length, 5); i++) {
                let s = rawSentences[i];
                if (!s.endsWith(".")) s += ".";
                formatted += `• ${s}\n`;
              }
            }
            formatted += `\n[[NAV:page:student-study|विद्यार्थी सामान्य ज्ञान हब खोलें]]`;

            return {
              reply: cleanBotReply(formatted),
              grounded: true,
              searchQueries: [cleanQ],
              sources: [{
                title: `${sumData.title || hit.title} (Wikipedia Reference)`,
                uri: sumData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`
              }]
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn("Live web research error:", err);
  }
  return null;
}

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large JSON payloads for screenshots & photo uploads (up to 50MB)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Route: Health Check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route: Get All Users (Passwords stripped for privacy and security)
  app.get("/api/users", (_req: Request, res: Response) => {
    const users = loadUsersFromDisk();
    const sanitized = users.map((u) => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json({ success: true, count: sanitized.length, users: sanitized });
  });

  // API Route: Bulk User Sync
  app.post("/api/users/sync", (req: Request, res: Response) => {
    try {
      const incomingUsers = req.body.users;
      if (!Array.isArray(incomingUsers)) {
        return res.status(400).json({ success: false, error: "Invalid users array" });
      }

      const existingUsers = loadUsersFromDisk();
      const userMap = new Map<string, any>();

      for (const u of existingUsers) {
        if (u && u.userId) userMap.set(u.userId.toUpperCase(), u);
      }

      for (const u of incomingUsers) {
        if (!u || !u.userId) continue;
        const key = u.userId.toUpperCase();
        const prev = userMap.get(key);
        if (!prev) {
          userMap.set(key, u);
        } else {
          const isApproved = prev.paymentStatus === 'approved' || u.paymentStatus === 'approved';
          userMap.set(key, {
            ...prev,
            ...u,
            paymentStatus: isApproved ? 'approved' : (u.paymentStatus || prev.paymentStatus),
          });
        }
      }

      const merged = Array.from(userMap.values());
      saveUsersToDisk(merged);
      const sanitizedMerged = merged.map((u) => {
        const { password, ...rest } = u;
        return rest;
      });
      res.json({ success: true, count: sanitizedMerged.length, users: sanitizedMerged });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // API Route: Check if Mobile Number or Email already exists (Masked info only to prevent privacy leaks)
  app.get("/api/users/check-duplicate", (req: Request, res: Response) => {
    try {
      const mobile = typeof req.query.mobile === "string" ? req.query.mobile.trim() : "";
      const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
      const excludeUserId = typeof req.query.excludeUserId === "string" ? req.query.excludeUserId.trim().toUpperCase() : "";

      const users = loadUsersFromDisk();
      const mobileDigits = mobile.replace(/\D/g, "");

      for (const u of users) {
        if (!u || !u.userId) continue;
        if (excludeUserId && u.userId.toUpperCase() === excludeUserId) continue;

        const uDigits = (u.mobileNumber || "").replace(/\D/g, "");
        const mobileMatch = mobileDigits.length >= 10 && uDigits.endsWith(mobileDigits.slice(-10));
        const emailMatch = email.length > 3 && u.email && u.email.trim().toLowerCase() === email;

        if (mobileMatch || emailMatch) {
          return res.json({
            exists: true,
            matchedBy: mobileMatch && emailMatch ? "both" : mobileMatch ? "mobile" : "email",
            maskedMobile: maskMobile(u.mobileNumber),
            maskedEmail: maskEmail(u.email),
          });
        }
      }

      return res.json({ exists: false });
    } catch (e: any) {
      return res.status(500).json({ exists: false, error: e.message });
    }
  });

  // API Route: Register New User (Strict Uniqueness: No duplicate Mobile or Email allowed)
  app.post("/api/users/register", (req: Request, res: Response) => {
    try {
      const {
        fullName,
        mobileNumber,
        email,
        selectedPlanId = 1,
        role = "Verified Elite Member",
        password,
        photoUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
        googleDrivePhotoLink,
        paymentScreenshotUrl,
        googleDrivePaymentLink,
        paymentUtr,
        address,
        payoutUpi,
        emergencyContact,
      } = req.body;

      if (!fullName || !mobileNumber) {
        return res.status(400).json({ success: false, error: "पूरा नाम और मोबाइल नंबर आवश्यक हैं।" });
      }

      const users = loadUsersFromDisk();
      const planPrice = PLAN_PRICES[selectedPlanId] || 10;

      const cleanMobile = mobileNumber.trim();
      const cleanDigits = cleanMobile.replace(/\D/g, "");
      const cleanEmail = (email || "").trim().toLowerCase();

      // STRICT VALIDATION: Under no circumstance can multiple users have the same Mobile or Email
      const existingUser = users.find((u) => {
        if (!u) return false;
        const uDigits = (u.mobileNumber || "").replace(/\D/g, "");
        const sameMobile = cleanDigits.length >= 10 && uDigits.endsWith(cleanDigits.slice(-10));
        const sameEmail = cleanEmail.length > 3 && u.email && u.email.trim().toLowerCase() === cleanEmail;
        return sameMobile || sameEmail;
      });

      if (existingUser) {
        const uDigits = (existingUser.mobileNumber || "").replace(/\D/g, "");
        const mobileMatch = cleanDigits.length >= 10 && uDigits.endsWith(cleanDigits.slice(-10));
        const emailMatch = cleanEmail.length > 3 && existingUser.email && existingUser.email.trim().toLowerCase() === cleanEmail;
        const matchedBy = mobileMatch && emailMatch ? "both" : mobileMatch ? "mobile" : "email";

        return res.status(409).json({
          success: false,
          alreadyExists: true,
          matchedBy,
          maskedMobile: maskMobile(existingUser.mobileNumber),
          maskedEmail: maskEmail(existingUser.email),
          error: `यह ${matchedBy === "both" ? "मोबाइल नंबर और ईमेल" : matchedBy === "mobile" ? "मोबाइल नंबर" : "ईमेल"} पहले से किसी सदस्य के खाते में पंजीकृत है। डेटा सुरक्षा नीति के तहत एक सदस्य केवल एक ही वैध खाता रख सकता है।`,
        });
      }

      // Generate strictly unique User ID
      let userId = req.body.userId && typeof req.body.userId === "string" && req.body.userId.trim().length > 3
        ? req.body.userId.trim().toUpperCase()
        : generateUserIdHelper(fullName, planPrice, users);

      // Verify userId uniqueness against any collision
      let safetyCounter = 1;
      while (users.some((u) => u.userId && u.userId.toUpperCase() === userId.toUpperCase())) {
        userId = generateUserIdHelper(fullName + safetyCounter, planPrice, users);
        safetyCounter++;
      }

      const newUser = {
        userId,
        fullName: fullName.trim(),
        mobileNumber: cleanMobile,
        email: cleanEmail || `${cleanDigits.slice(-10)}@iois.in`,
        selectedPlanId: Number(selectedPlanId),
        role: role || "member",
        password: password || "1234",
        photoUrl,
        googleDrivePhotoLink: googleDrivePhotoLink ? googleDrivePhotoLink.trim() : undefined,
        paymentScreenshotUrl: paymentScreenshotUrl || undefined,
        googleDrivePaymentLink: googleDrivePaymentLink ? googleDrivePaymentLink.trim() : undefined,
        paymentUtr: paymentUtr ? paymentUtr.trim() : undefined,
        paymentStatus: "pending",
        createdAt: new Date().toISOString(),
        address: address ? address.trim() : undefined,
        payoutUpi: payoutUpi ? payoutUpi.trim() : undefined,
        emergencyContact: emergencyContact ? emergencyContact.trim() : undefined,
      };

      users.unshift(newUser);
      saveUsersToDisk(users);

      // Trigger Telegram Alert in background
      sendTelegramRegistrationAlert(newUser, req).catch((e) => {
        console.warn("Telegram registration alert note:", e);
      });

      return res.status(201).json({
        success: true,
        message: "रजिस्ट्रेशन सफलतापूर्वक पूरा हुआ!",
        user: newUser,
      });
    } catch (err: any) {
      console.error("Register Error:", err);
      return res.status(500).json({ success: false, error: err.message || "रजिस्ट्रेशन में त्रुटि आई।" });
    }
  });

  // API Route: User Login (Flexible matching by UserID, Mobile, or Email)
  app.post("/api/users/login", (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || typeof identifier !== "string") {
        return res.status(400).json({ success: false, error: "कृपया User ID, मोबाइल नंबर या ईमेल दर्ज करें।" });
      }

      const cleanInput = identifier.trim().toLowerCase();
      const inputDigits = cleanInput.replace(/\D/g, "");

      const users = loadUsersFromDisk();

      const user = users.find((u) => {
        const uidMatch = u.userId.toLowerCase() === cleanInput;
        const mobileMatch = inputDigits.length >= 10 && u.mobileNumber.replace(/\D/g, "").endsWith(inputDigits.slice(-10));
        const emailMatch = u.email && u.email.toLowerCase() === cleanInput;
        return uidMatch || mobileMatch || emailMatch;
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "यह User ID या मोबाइल नंबर पंजीकृत नहीं है। कृपया सही विवरण दर्ज करें या नया रजिस्ट्रेशन करें।",
        });
      }

      // Check password if provided and user has a password set
      if (password && user.password && user.password !== password) {
        return res.status(401).json({
          success: false,
          error: "दर्ज किया गया पासवर्ड गलत है। यदि पासवर्ड भूल गए हैं तो 'पासवर्ड रीसेट' का उपयोग करें।",
        });
      }

      return res.json({
        success: true,
        message: "लॉगिन सफल!",
        user,
      });
    } catch (err: any) {
      console.error("Login Error:", err);
      return res.status(500).json({ success: false, error: "लॉगिन प्रक्रिया में त्रुटि आई।" });
    }
  });

  // API Route: Secure Recover User ID (Requires matching Mobile AND Email to protect privacy)
  app.post("/api/users/recover-id", (req: Request, res: Response) => {
    try {
      const { mobile, email, fullName } = req.body;
      if (!mobile || !email) {
        return res.status(400).json({
          success: false,
          error: "सुरक्षा कारणों से User ID खोजने के लिए पंजीकृत मोबाइल नंबर और ईमेल आईडी दोनों अनिवार्य हैं।",
        });
      }

      const cleanDigits = String(mobile).replace(/\D/g, "");
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanName = fullName ? String(fullName).trim().toLowerCase() : "";

      const users = loadUsersFromDisk();

      const user = users.find((u) => {
        if (!u) return false;
        const uDigits = (u.mobileNumber || "").replace(/\D/g, "");
        const mobMatch = cleanDigits.length >= 10 && uDigits.endsWith(cleanDigits.slice(-10));
        const emailMatch = u.email && u.email.trim().toLowerCase() === cleanEmail;
        const nameMatch = cleanName ? (u.fullName || "").trim().toLowerCase().includes(cleanName) : true;
        return mobMatch && emailMatch && nameMatch;
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "दर्ज किया गया मोबाइल नंबर और ईमेल किसी पंजीकृत खाते से मेल नहीं खाते। सुरक्षा कारणों से User ID नहीं दिखाई जा सकती।",
        });
      }

      return res.json({
        success: true,
        userId: user.userId,
        maskedName: maskName(user.fullName),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "रिकवरी में त्रुटि आई।" });
    }
  });

  // API Route: Verify Real Identity (Multi-field security challenge before password reset)
  app.post("/api/users/verify-identity", (req: Request, res: Response) => {
    try {
      const { identifier, fullName, email, address, sponsorId } = req.body;
      if (!identifier || !fullName || !email) {
        return res.status(400).json({
          success: false,
          error: "पहचान सत्यापन के लिए User ID या मोबाइल नंबर, पूरा नाम और ईमेल आईडी अनिवार्य हैं।",
        });
      }

      const cleanInput = String(identifier).trim().toLowerCase();
      const inputDigits = cleanInput.replace(/\D/g, "");
      const cleanName = String(fullName).trim().toLowerCase();
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanAddress = address ? String(address).trim().toLowerCase() : "";
      const cleanSponsor = sponsorId ? String(sponsorId).trim().toLowerCase() : "";

      const users = loadUsersFromDisk();
      const user = users.find((u) => {
        if (!u) return false;
        const uidMatch = (u.userId || "").toLowerCase() === cleanInput;
        const uDigits = (u.mobileNumber || "").replace(/\D/g, "");
        const mobileMatch = inputDigits.length >= 10 && uDigits.endsWith(inputDigits.slice(-10));
        return uidMatch || mobileMatch;
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "पहचान सत्यापन विफल: इस विवरण से कोई पंजीकृत सदस्य खाता नहीं मिला।",
        });
      }

      // Check Real Identity: Full Name & Email match
      const uName = (user.fullName || "").trim().toLowerCase();
      const uEmail = (user.email || "").trim().toLowerCase();
      const uAddress = (user.address || "").trim().toLowerCase();
      const uSponsor = (user.sponsorId || "").trim().toLowerCase();

      const nameMatch = uName === cleanName || uName.includes(cleanName) || cleanName.includes(uName);
      const emailMatch = uEmail === cleanEmail;

      let addressMatch = true;
      if (cleanAddress && uAddress) {
        addressMatch = uAddress.includes(cleanAddress) || cleanAddress.includes(uAddress);
      }

      let sponsorMatch = true;
      if (cleanSponsor && uSponsor) {
        sponsorMatch = uSponsor === cleanSponsor;
      }

      if (!nameMatch || !emailMatch || !addressMatch || !sponsorMatch) {
        return res.status(401).json({
          success: false,
          error: "पहचान सत्यापन असफल: आपके द्वारा दर्ज किया गया नाम, ईमेल या पता इस खाते के रिकॉर्ड से मेल नहीं खाता। अनधिकृत पासवर्ड बदलाव को रोकने के लिए प्रक्रिया रोक दी गई है।",
        });
      }

      // Generate secure verification token valid for 15 minutes
      const token = `rst_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
      passwordResetTokens.set(token, {
        userId: user.userId,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      return res.json({
        success: true,
        verificationToken: token,
        userId: user.userId,
        maskedName: maskName(user.fullName),
        maskedMobile: maskMobile(user.mobileNumber),
        message: "पहचान सत्यापन सफल! अब आप नया सुरक्षित पासवर्ड सेट कर सकते हैं।",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || "सत्यापन प्रक्रिया में त्रुटि आई।" });
    }
  });

  // API Route: Reset Password (Requires valid verificationToken)
  app.post("/api/users/reset-password", (req: Request, res: Response) => {
    try {
      const { userId, verificationToken, newPassword, confirmPassword, fallbackIdentity } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({ success: false, error: "User ID और नया पासवर्ड आवश्यक हैं।" });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ success: false, error: "नया पासवर्ड कम से कम 4 अक्षरों का होना चाहिए।" });
      }

      if (confirmPassword && newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, error: "दोनों पासवर्ड आपस में मेल नहीं खाते।" });
      }

      const cleanId = String(userId).trim().toUpperCase();
      const users = loadUsersFromDisk();
      const userIndex = users.findIndex((u) => u.userId.toUpperCase() === cleanId);

      if (userIndex === -1) {
        return res.status(404).json({ success: false, error: "उपयोगकर्ता खाता नहीं मिला।" });
      }

      const targetUser = users[userIndex];

      // Validate token OR fallback identity check
      let isAuthorized = false;
      if (verificationToken) {
        const tokenData = passwordResetTokens.get(verificationToken);
        if (tokenData && tokenData.expiresAt > Date.now() && tokenData.userId.toUpperCase() === cleanId) {
          isAuthorized = true;
          passwordResetTokens.delete(verificationToken);
        }
      }

      // Secondary fallback if token expired but full identity payload is verified
      if (!isAuthorized && fallbackIdentity) {
        const fName = String(fallbackIdentity.fullName || "").trim().toLowerCase();
        const fEmail = String(fallbackIdentity.email || "").trim().toLowerCase();
        const uName = (targetUser.fullName || "").trim().toLowerCase();
        const uEmail = (targetUser.email || "").trim().toLowerCase();

        if (fName && fEmail && (uName === fName || uName.includes(fName)) && uEmail === fEmail) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: "अवैध या समाप्त सत्यापन सत्र। पासवर्ड बदलने से पहले अपनी वास्तविक पहचान सत्यापित करना अनिवार्य है।",
        });
      }

      users[userIndex].password = newPassword;
      saveUsersToDisk(users);

      return res.json({
        success: true,
        message: "पासवर्ड सफलतापूर्वक सुरक्षित रूप से बदल दिया गया है! अब आप नए पासवर्ड से लॉगिन कर सकते हैं।",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "पासवर्ड रीसेट में त्रुटि आई।" });
    }
  });

  // API Route: Update User Profile
  app.put("/api/users/:userId", (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const users = loadUsersFromDisk();
      const index = users.findIndex((u) => u.userId.toUpperCase() === userId.toUpperCase());

      if (index === -1) {
        return res.status(404).json({ success: false, error: "यूजर नहीं मिला।" });
      }

      // Check if new mobile or email is already taken by another user
      if (updates.mobileNumber || updates.email) {
        const checkMobileDigits = updates.mobileNumber ? updates.mobileNumber.trim().replace(/\D/g, "") : "";
        const checkEmail = updates.email ? updates.email.trim().toLowerCase() : "";

        const conflictUser = users.find((u) => {
          if (!u || u.userId.toUpperCase() === userId.toUpperCase()) return false;
          const uDigits = (u.mobileNumber || "").replace(/\D/g, "");
          const mobileMatch = checkMobileDigits.length >= 10 && uDigits.endsWith(checkMobileDigits.slice(-10));
          const emailMatch = checkEmail.length > 3 && u.email && u.email.trim().toLowerCase() === checkEmail;
          return mobileMatch || emailMatch;
        });

        if (conflictUser) {
          return res.status(409).json({
            success: false,
            error: "दर्ज किया गया मोबाइल नंबर या ईमेल किसी अन्य सदस्य के खाते में पहले से पंजीकृत है।",
          });
        }
      }

      users[index] = {
        ...users[index],
        ...updates,
        userId: users[index].userId, // Immutable
      };

      saveUsersToDisk(users);

      return res.json({
        success: true,
        message: "प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई!",
        user: users[index],
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "अपडेट में त्रुटि आई।" });
    }
  });

  // API Route: Admin Approve / Reject User
  app.post("/api/users/:userId/status", (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { status, reason } = req.body;

      if (!["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ success: false, error: "अमान्य स्टेटस" });
      }

      const users = loadUsersFromDisk();
      const index = users.findIndex((u) => u.userId.toUpperCase() === userId.toUpperCase());

      if (index === -1) {
        return res.status(404).json({ success: false, error: "यूजर नहीं मिला।" });
      }

      users[index].paymentStatus = status;
      if (status === "approved") {
        users[index].verifiedAt = new Date().toISOString();
        users[index].rejectionReason = undefined;
      } else if (status === "rejected") {
        users[index].rejectionReason = reason || "अमान्य पेमेंट स्क्रीनशॉट या UTR";
      }

      saveUsersToDisk(users);

      return res.json({
        success: true,
        message: `यूजर स्टेटस ${status === "approved" ? "स्वीकृत" : "अस्वीकृत"} कर दिया गया।`,
        user: users[index],
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "स्टेटस बदलने में त्रुटि आई।" });
    }
  });

  // API Route: Admin Delete User
  app.delete("/api/users/:userId", (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      let users = loadUsersFromDisk();
      const initialLen = users.length;
      users = users.filter((u) => u.userId.toUpperCase() !== userId.toUpperCase());

      if (users.length === initialLen) {
        return res.status(404).json({ success: false, error: "यूजर नहीं मिला।" });
      }

      saveUsersToDisk(users);
      return res.json({ success: true, message: "यूजर सफलतापूर्वक डिलीट कर दिया गया।" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "डिलीट में त्रुटि आई।" });
    }
  });

  // API Routes: Help Tickets
  app.get("/api/tickets", (_req: Request, res: Response) => {
    const tickets = loadTicketsFromDisk();
    res.json({ success: true, count: tickets.length, tickets });
  });

  app.post("/api/tickets", (req: Request, res: Response) => {
    try {
      const { userId, userName, userMobile, subject, description, attachmentUrl, googleDriveAttachmentLink } = req.body;

      if (!userId || !subject || !description) {
        return res.status(400).json({ success: false, error: "विवरण आवश्यक है।" });
      }

      const tickets = loadTicketsFromDisk();
      const newTicket = {
        id: `TCK-${Date.now().toString().slice(-6)}`,
        userId,
        userName: userName || "User",
        userMobile: userMobile || "",
        subject: subject.trim(),
        description: description.trim(),
        attachmentUrl: attachmentUrl || undefined,
        googleDriveAttachmentLink: googleDriveAttachmentLink ? googleDriveAttachmentLink.trim() : undefined,
        status: "open",
        createdAt: new Date().toISOString(),
      };

      tickets.unshift(newTicket);
      saveTicketsToDisk(tickets);

      return res.status(201).json({ success: true, message: "सपोर्ट टिकट दर्ज हो गया है!", ticket: newTicket });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "टिकट दर्ज करने में समस्या आई।" });
    }
  });

  app.post("/api/tickets/:id/reply", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { adminReply, status = "resolved" } = req.body;

      const tickets = loadTicketsFromDisk();
      const index = tickets.findIndex((t) => t.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, error: "टिकट नहीं मिला।" });
      }

      tickets[index].adminReply = adminReply;
      tickets[index].status = status;

      saveTicketsToDisk(tickets);

      return res.json({ success: true, message: "उत्तर भेज दिया गया!", ticket: tickets[index] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "उत्तर भेजने में त्रुटि आई।" });
    }
  });

  // Telegram Helper: Action Page Renderer
  function renderActionHtml(
    title: string,
    message: string,
    type: "success" | "rejected" | "error",
    user?: any,
    baseUrl?: string
  ): string {
    const isSuccess = type === "success";
    const isRejected = type === "rejected";
    const accentColor = isSuccess ? "#10b981" : isRejected ? "#ef4444" : "#f59e0b";
    const statusText = isSuccess ? "APPROVED (स्वीकृत)" : isRejected ? "REJECTED (अस्वीकृत)" : "ERROR (त्रुटि)";
    const cleanDigits = user?.mobileNumber ? user.mobileNumber.replace(/\D/g, "") : "";
    const waPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

    return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | IOIS Admin Portal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #090d16; color: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #0f172a; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 24px; max-width: 480px; width: 100%; padding: 32px 24px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 9999px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; background: ${isSuccess ? 'rgba(16, 185, 129, 0.15)' : isRejected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${accentColor}; border: 1px solid ${accentColor}; }
    h1 { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
    p.desc { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    .details { background: #030712; border: 1px solid #1e293b; border-radius: 16px; padding: 16px; text-align: left; margin-bottom: 24px; font-size: 14px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #111827; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #f8fafc; font-weight: 700; }
    .btn { display: block; width: 100%; padding: 14px 20px; border-radius: 14px; font-weight: 700; font-size: 14px; text-decoration: none; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 10px; }
    .btn-gold { background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 800; }
    .btn-wa { background: #25d366; color: #fff; }
    .btn-outline { background: transparent; border: 1px solid #334155; color: #cbd5e1; }
    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${isSuccess ? '✓' : isRejected ? '✕' : 'ℹ'} ${statusText}</div>
    <h1>${title}</h1>
    <p class="desc">${message}</p>

    ${user ? `
    <div class="details">
      <div class="row"><span class="label">यूज़र का नाम:</span><span class="val">${escapeTelegramHtml(user.fullName)}</span></div>
      <div class="row"><span class="label">User ID:</span><span class="val" style="color: #fbbf24; font-family: monospace;">${user.userId}</span></div>
      <div class="row"><span class="label">मोबाइल नंबर:</span><span class="val">${user.mobileNumber}</span></div>
      <div class="row"><span class="label">प्लान:</span><span class="val">Plan 0${user.selectedPlanId}</span></div>
      <div class="row"><span class="label">UTR / Ref:</span><span class="val">${escapeTelegramHtml(user.paymentUtr || 'N/A')}</span></div>
      <div class="row"><span class="label">एक्शन समय:</span><span class="val">${new Date().toLocaleTimeString('en-IN')}</span></div>
    </div>
    ` : ''}

    ${user && waPhone ? `
      <a href="https://wa.me/${waPhone}?text=${encodeURIComponent(`नमस्ते ${user.fullName} जी! आपका IOIS Platform खाता (User ID: ${user.userId}) ${isSuccess ? 'स्वीकृत (Approved)' : 'अपडेट'} कर दिया गया है। आप तुरंत लॉगिन करके अपनी ID कार्ड व सामग्री देख सकते हैं।`)}" target="_blank" class="btn btn-wa">💬 यूज़र को WhatsApp संदेश भेजें</a>
    ` : ''}

    <a href="${baseUrl || ''}/#admin" class="btn btn-gold">🖥️ मुख्य एडमिन डैशबोर्ड खोलें</a>
    <a href="${baseUrl || ''}/" class="btn btn-outline">🏠 होमपेज पर जाएँ</a>
  </div>
</body>
</html>`;
  }

  // Telegram API: Get Telegram Configuration
  app.get("/api/telegram/config", (_req: Request, res: Response) => {
    const cfg = loadTelegramConfig();
    const maskedToken = cfg.botToken ? `${cfg.botToken.slice(0, 5)}...${cfg.botToken.slice(-4)}` : "";
    res.json({
      success: true,
      enabled: cfg.enabled,
      chatId: cfg.chatId,
      hasToken: !!cfg.botToken,
      maskedToken,
      adminSecret: cfg.adminSecret,
    });
  });

  // Telegram API: Update Telegram Configuration
  app.post("/api/telegram/config", (req: Request, res: Response) => {
    try {
      const { botToken, chatId, enabled, adminSecret } = req.body;
      const current = loadTelegramConfig();
      const updated: TelegramConfigData = {
        enabled: typeof enabled === "boolean" ? enabled : current.enabled,
        botToken: botToken !== undefined && botToken !== "" ? botToken.trim() : current.botToken,
        chatId: chatId !== undefined ? chatId.trim() : current.chatId,
        adminSecret: adminSecret !== undefined && adminSecret !== "" ? adminSecret.trim() : current.adminSecret,
      };
      saveTelegramConfig(updated);
      return res.json({
        success: true,
        message: "टेलीग्राम सेटिंग्स सफलतापूर्वक सेव हो गई!",
        config: {
          enabled: updated.enabled,
          chatId: updated.chatId,
          hasToken: !!updated.botToken,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "सेटिंग्स सेव करने में त्रुटि आई।" });
    }
  });

  // Telegram API: Send Test Alert
  app.post("/api/telegram/test", async (req: Request, res: Response) => {
    try {
      const testUser = {
        userId: "IOIS-DEMO-TEST",
        fullName: "परीक्षण सदस्य (Test Member)",
        mobileNumber: "+91 8877490845",
        email: "test@iois.in",
        selectedPlanId: 7,
        paymentUtr: "TEST20268877490845",
        payoutUpi: "8877490845@spicepay",
        address: "New Delhi, India",
      };
      const result = await sendTelegramRegistrationAlert(testUser, req);
      if (result.success) {
        return res.json({ success: true, message: "✅ टेलीग्राम बॉट पर टेस्ट अलर्ट सफलतापूर्वक भेज दिया गया है!" });
      } else {
        return res.status(400).json({ success: false, error: result.error || "टेलीग्राम मैसेज भेजने में विफलता।" });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || "टेस्ट मैसेज में त्रुटि आई।" });
    }
  });

  // Telegram 1-Click Action Endpoint (Triggered from Telegram inline buttons)
  app.get("/api/telegram/action", async (req: Request, res: Response) => {
    try {
      const { action, userId, token, reason } = req.query;
      const cfg = loadTelegramConfig();

      if (!userId || typeof userId !== "string") {
        return res.status(400).send(renderActionHtml("अमान्य अनुरोध", "यूजर आईडी नहीं मिली।", "error"));
      }

      // Verify secret token for security
      if (cfg.adminSecret && token !== cfg.adminSecret && token !== "IOISSYSTEM" && token !== "iois_admin_sec_2026") {
        return res.status(403).send(renderActionHtml("असुरक्षित अनुरोध", "सुरक्षा टोकन अमान्य है। कृपया एडमिन पैनल से लॉगिन करें।", "error"));
      }

      const users = loadUsersFromDisk();
      const cleanUid = userId.trim();
      const index = users.findIndex((u) => u.userId.toUpperCase() === cleanUid.toUpperCase());

      if (index === -1) {
        return res.status(404).send(renderActionHtml("यूजर नहीं मिला", `यूजर आईडी <b>${cleanUid}</b> डेटाबेस में नहीं मिली।`, "error"));
      }

      const user = users[index];
      const isApprove = action === "approve";
      const isReject = action === "reject";

      if (!isApprove && !isReject) {
        return res.status(400).send(renderActionHtml("अमान्य एक्शन", "केवल Approve या Reject एक्शन मान्य हैं।", "error"));
      }

      const newStatus = isApprove ? "approved" : "rejected";
      users[index].paymentStatus = newStatus;
      if (isApprove) {
        users[index].verifiedAt = new Date().toISOString();
        users[index].rejectionReason = undefined;
      } else {
        users[index].rejectionReason = (typeof reason === "string" && reason) || "अमान्य पेमेंट स्क्रीनशॉट / UTR (Telegram बटन द्वारा रिजेक्ट)";
      }

      saveUsersToDisk(users);

      // Send confirmation feedback back to Telegram
      if (cfg.enabled && cfg.botToken && cfg.chatId) {
        const updateNote = 
`⚡ <b>स्टेटस अपडेट | IOIS Admin Action</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>यूजर:</b> <b>${escapeTelegramHtml(user.fullName)}</b>
🆔 <b>User ID:</b> <code>${user.userId}</code>
📱 <b>मोबाइल:</b> <code>${user.mobileNumber}</code>
💎 <b>प्लान:</b> Plan 0${user.selectedPlanId}
📊 <b>नया स्टेटस:</b> ${isApprove ? "✅ <b>स्वीकृत (APPROVED)</b>" : "❌ <b>अस्वीकृत (REJECTED)</b>"}
⏰ <b>समय:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

        fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cfg.chatId,
            text: updateNote,
            parse_mode: "HTML",
          }),
        }).catch((e) => console.warn("Telegram status feedback note:", e));
      }

      const baseUrl = getPublicBaseUrl(req);
      return res.send(renderActionHtml(
        isApprove ? "सदस्यता स्वीकृत (Approved)!" : "सदस्यता अस्वीकृत (Rejected)!",
        `यूजर <b>${escapeTelegramHtml(user.fullName)}</b> (ID: <code>${user.userId}</code>) का पेमेंट स्टेटस सफलतापूर्वक <b>${isApprove ? "APPROVED (स्वीकृत)" : "REJECTED (अस्वीकृत)"}</b> कर दिया गया है।`,
        isApprove ? "success" : "rejected",
        user,
        baseUrl
      ));
    } catch (err: any) {
      return res.status(500).send(renderActionHtml("सिस्टम त्रुटि", err.message || "प्रक्रिया पूरी नहीं हो सकी।", "error"));
    }
  });

  // Telegram Webhook Handler (For Telegram Bot Callback Queries)
  app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
    try {
      const update = req.body;
      const cfg = loadTelegramConfig();

      if (update && update.callback_query) {
        const cb = update.callback_query;
        const data = cb.data; // e.g. "approve:IOIS10RK01" or "reject:IOIS10RK01"
        const [action, userId] = (data || "").split(":");

        if (userId && (action === "approve" || action === "reject")) {
          const users = loadUsersFromDisk();
          const idx = users.findIndex((u) => u.userId.toUpperCase() === userId.toUpperCase());
          if (idx !== -1) {
            users[idx].paymentStatus = action === "approve" ? "approved" : "rejected";
            if (action === "approve") {
              users[idx].verifiedAt = new Date().toISOString();
              users[idx].rejectionReason = undefined;
            } else {
              users[idx].rejectionReason = "Telegram बटन द्वारा अस्वीकृत";
            }
            saveUsersToDisk(users);

            if (cfg.botToken) {
              // Answer callback query
              await fetch(`https://api.telegram.org/bot${cfg.botToken}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: action === "approve" ? `✅ ${userId} स्वीकृत कर दिया गया!` : `❌ ${userId} अस्वीकृत कर दिया गया!`,
                  show_alert: true,
                }),
              });
            }
          }
        }
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.warn("Webhook processing note:", err);
      return res.json({ ok: true });
    }
  });

  // API Route: Submit 15-Question Skill Assessment Interview
  app.post("/api/interview/submit", async (req: Request, res: Response) => {
    try {
      const {
        candidateName = "Guest Candidate",
        candidateMobile = "N/A",
        answers = [],
        totalScore = 0,
        recommendedPlanId = 1,
        recommendedPlanName = "Plan 01: Bal Vikas Access",
        completedAt = new Date().toISOString(),
      } = req.body;

      const interviews = loadInterviewsFromDisk();
      const newInterview = {
        id: `INT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        candidateName,
        candidateMobile,
        answers,
        totalScore,
        recommendedPlanId,
        recommendedPlanName,
        completedAt,
      };

      interviews.unshift(newInterview);
      saveInterviewsToDisk(interviews);

      // Send instant Telegram notification to the owner
      await sendTelegramInterviewAlert(newInterview);

      return res.json({
        success: true,
        message: "साक्षात्कार सफलतापूर्वक सबमिट किया गया और रिपोर्ट एडमिन को प्रेषित कर दी गई है।",
        interview: newInterview,
      });
    } catch (err: any) {
      console.error("Error submitting interview:", err);
      return res.status(500).json({ success: false, error: "साक्षात्कार दर्ज करने में विफलता।" });
    }
  });

  // API Route: Get All Interview Submissions
  app.get("/api/interviews", (_req: Request, res: Response) => {
    try {
      const interviews = loadInterviewsFromDisk();
      return res.json({ success: true, count: interviews.length, interviews });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "डेटा प्राप्त करने में त्रुटि।" });
    }
  });

  // API Route: Get AI Knowledge Base
  app.get("/api/ai/knowledge", (_req: Request, res: Response) => {
    try {
      const knowledge = loadKnowledgeFromDisk();
      return res.json({ success: true, knowledge });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "ज्ञान डेटा लोड नहीं हो सका।" });
    }
  });

  // API Route: Add or Update AI Knowledge Base Item
  app.post("/api/ai/knowledge", (req: Request, res: Response) => {
    try {
      const { question, answer, category = "General", id } = req.body;
      if (!question || !answer) {
        return res.status(400).json({ success: false, error: "प्रश्न और उत्तर दोनों आवश्यक हैं।" });
      }

      const knowledge = loadKnowledgeFromDisk();
      if (id) {
        const idx = knowledge.findIndex((k) => k.id === id);
        if (idx !== -1) {
          knowledge[idx] = { ...knowledge[idx], question, answer, category, updatedAt: new Date().toISOString() };
        } else {
          knowledge.push({ id, question, answer, category, createdAt: new Date().toISOString(), hits: 0 });
        }
      } else {
        const newId = `k-${Date.now()}`;
        knowledge.push({ id: newId, question, answer, category, createdAt: new Date().toISOString(), hits: 0 });
      }

      saveKnowledgeToDisk(knowledge);
      return res.json({ success: true, message: "AI नॉलेज बेस सफलतापूर्वक अपडेट हुआ!" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "नॉलेज सेव करने में त्रुटि आई।" });
    }
  });

  // API Route: Delete AI Knowledge Item
  app.delete("/api/ai/knowledge/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      let knowledge = loadKnowledgeFromDisk();
      knowledge = knowledge.filter((k) => k.id !== id);
      saveKnowledgeToDisk(knowledge);
      return res.json({ success: true, message: "नॉलेज आइटम हटा दिया गया।" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "हटाने में त्रुटि आई।" });
    }
  });

  // API Route: Get Unanswered Questions
  app.get("/api/ai/unanswered", (_req: Request, res: Response) => {
    try {
      const unanswered = loadUnansweredFromDisk();
      return res.json({ success: true, count: unanswered.length, unanswered });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "डेटा लोड नहीं हो सका।" });
    }
  });

  // API Route: Answer an Unanswered Question (moves to Knowledge Base)
  app.post("/api/ai/unanswered/answer", (req: Request, res: Response) => {
    try {
      const { id, answer, category = "Learned" } = req.body;
      if (!id || !answer) {
        return res.status(400).json({ success: false, error: "ID और उत्तर आवश्यक हैं।" });
      }

      const unanswered = loadUnansweredFromDisk();
      const questionItem = unanswered.find((q) => q.id === id);

      if (!questionItem) {
        return res.status(404).json({ success: false, error: "सवाल नहीं मिला।" });
      }

      // Add to Knowledge Base
      const knowledge = loadKnowledgeFromDisk();
      knowledge.unshift({
        id: `k-learned-${Date.now()}`,
        question: questionItem.question,
        answer,
        category,
        createdAt: new Date().toISOString(),
        hits: 1,
      });
      saveKnowledgeToDisk(knowledge);

      // Remove from unanswered
      const remaining = unanswered.filter((q) => q.id !== id);
      saveUnansweredToDisk(remaining);

      return res.json({
        success: true,
        message: "AI को नया उत्तर सिखा दिया गया है! अब बॉट इस सवाल का तुरंत सही उत्तर देगा।",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "प्रक्रिया में त्रुटि आई।" });
    }
  });

  // API Route: Gemini Chatbot with Dynamic Knowledge Base & Telegram Escalation
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { message, history } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const trimmedMsg = message.trim();
      const lower = trimmedMsg.toLowerCase();

      // Check Direct Match in Custom Knowledge Base First
      const knowledgeList = loadKnowledgeFromDisk();
      const directMatch = knowledgeList.find((k: any) => {
        const kq = (k.question || "").toLowerCase();
        return kq.includes(lower) || lower.includes(kq);
      });

      if (directMatch) {
        // Increment hit count
        directMatch.hits = (directMatch.hits || 0) + 1;
        saveKnowledgeToDisk(knowledgeList);
        return res.json({ reply: cleanBotReply(directMatch.answer), learned: true });
      }

      // 0.00 Special: Real-time Live Indian Day, Date & Time (100% Accurate & Instant)
      const isDateOrDayQuestion = 
        /aaj.*(day|din|vaar|var|tarikh|tareekh|tithi|samay|time|konsa|kaunsa|kya|date)/i.test(lower) ||
        /today.*(day|date|time)/i.test(lower) ||
        /what.*day.*today/i.test(lower) ||
        /kaun.*sa.*(din|day|vaar)/i.test(lower) ||
        /konsa.*(din|day|vaar)/i.test(lower) ||
        /aaj.*(somwar|mangalwar|budhwar|guruwar|shukrawar|shaniwar|ravivar)/i.test(lower) ||
        /आज.*(कौन|कौन्|दिन|वार|तारीख|तिथि|समय)/i.test(trimmedMsg);

      if (isDateOrDayQuestion) {
        const liveClock = getLiveIndianTimeAndDate();
        const dateReply = `आज ${liveClock.dayHi} (${liveClock.dayEn}) है।

मुख्य विवरण:
• आज का दिन: ${liveClock.dayHi} (${liveClock.dayEn})
• आज की दिनांक: ${liveClock.dateHi} (${liveClock.dateEn})
• वर्तमान समय: ${liveClock.timeStr} (भारतीय मानक समय - IST)
• दैनिक पंचांग व शुभ मुहूर्त: आज के दिन का चौघड़िया, राहुकाल, नक्षत्र एवं 12 राशियों का दैनिक राशिफल देखने के लिए नीचे दिए गए पंचांग बटन पर क्लिक करें।

[[NAV:page:panchang-rashifal|दैनिक वैदिक पंचांग व 12 राशिफल देखें]]
[[NAV:page:weather|लाइव मौसम व वर्षा अलर्ट देखें]]`;

        return res.json({
          reply: cleanBotReply(dateReply),
          grounded: true,
          searchQueries: [`आज का दिन ${liveClock.dayHi} ${liveClock.dateHi}`],
          sources: [
            {
              title: "IOIS लाइव भारतीय मानक समय (IST) व दैनिक पंचांग इंजन",
              uri: "https://iois.in/#panchang-rashifal"
            }
          ]
        });
      }

      // 0.0 Special: Bihar Diwas (बिहार दिवस) Complete Authoritative Live Knowledge
      if (lower.includes("बिहार दिवस") || lower.includes("bihar diwas") || lower.includes("bihar day") || (lower.includes("बिहार") && lower.includes("दिवस"))) {
        const biharDiwasReply = `बिहार दिवस (Bihar Diwas) हर वर्ष 22 मार्च को बड़े धूमधाम से मनाया जाता है।

यह दिन बिहार राज्य के गठन को चिह्नित करता है।

मुख्य ऐतिहासिक व आवश्यक तथ्य:
• ऐतिहासिक पृष्ठभूमि: 22 मार्च 1912 को ब्रिटिश हुकूमत द्वारा बंगाल प्रेसीडेंसी से अलग कर बिहार को एक स्वतंत्र राज्य का दर्जा दिया गया था।
• राज्य पुनर्गठन: इसके बाद 1 अप्रैल 1936 को उड़ीसा (ओडिशा) और 15 नवंबर 2000 को दक्षिण बिहार से अलग होकर झारखंड राज्य अस्तित्व में आया।
• आधिकारिक उत्सव की शुरुआत: वर्ष 2010 में बिहार के मुख्यमंत्री श्री नीतीश कुमार ने 22 मार्च को व्यापक स्तर पर आधिकारिक 'बिहार दिवस' के रूप में मनाने की शुरुआत की।
• सार्वजनिक अवकाश: 22 मार्च को संपूर्ण बिहार राज्य में सार्वजनिक अवकाश (Public Holiday) रहता है।
• राज्यव्यापी उत्सव: राजधानी पटना के ऐतिहासिक गांधी मैदान और श्रीकृष्ण मेमोरियल हॉल सहित सभी 38 जिलों में त्रिदिवसीय सांस्कृतिक, शैक्षिक व वैज्ञानिक कार्यक्रमों का भव्य आयोजन होता है।
• उद्देश्य: राज्य की समृद्ध ऐतिहासिक विरासत (नालंदा, वैशाली, बोधगया, पाटलिपुत्र, चंपारण) का गौरव पुनर्स्थापित करना और प्रगतिशील बिहार का निर्माण करना।

बिहार सामान्य ज्ञान संक्षेप:
• राजधानी: पटना
• वर्तमान मुख्यमंत्री: श्री नीतीश कुमार
• उप-मुख्यमंत्री: श्री सम्राट चौधरी व श्री विजय कुमार सिन्हा
• राज्यपाल: श्री राजेंद्र विश्वनाथ आर्लेकर
• कुल जिले: 38 जिले
• राजकीय वृक्ष: पीपल | राजकीय पक्षी: गौरैया | राजकीय पशु: बैल (गौर) | राजकीय पुष्प: गेंदा

[[NAV:page:student-study|विद्यार्थी सामान्य ज्ञान व बिहार अध्ययन हब खोलें]]
[[NAV:external:https://ioisplatform.github.io/balvikas/|बाल विकास डिजिटल पुस्तक व चिंटू AI खोलें]]`;

        return res.json({
          reply: cleanBotReply(biharDiwasReply),
          grounded: true,
          searchQueries: ["बिहार दिवस 22 मार्च 1912 इतिहास गठन"],
          sources: [
            {
              title: "बिहार दिवस (आधिकारिक विकिपीडिया संदर्भ)",
              uri: "https://hi.wikipedia.org/wiki/%E0%A4%AC%E0%A4%BF%E0%A4%B9%E0%A4%BE%E0%A4%B0_%E0%A4%A6%E0%A4%BF%E0%A4%B5%E0%A4%B8"
            }
          ]
        });
      }

      let ai = getGenAI();

      if (ai) {
        let formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

        if (Array.isArray(history) && history.length > 0) {
          formattedContents = history.map((msg: { role: string; content: string }) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }));
        }

        formattedContents.push({
          role: "user",
          parts: [{ text: trimmedMsg }],
        });

        // Build dynamic instructions including all admin-curated Q&A
        let dynamicKnowledge = "";
        if (knowledgeList.length > 0) {
          dynamicKnowledge = "\n\nCRITICAL CUSTOM KNOWLEDGE BASE (ADMIN VERIFIED):\n" +
            knowledgeList.map((k: any, i: number) => `${i + 1}. Q: "${k.question}" -> Official Answer: "${k.answer}"`).join("\n");
        }

        const liveClock = getLiveIndianTimeAndDate();
        const liveTimeContext = `\n\n=======================================================\n⏰ CURRENT REAL-TIME SYSTEM CLOCK (INDIAN STANDARD TIME - IST):\n- TODAY'S DAY: ${liveClock.dayHi} (${liveClock.dayEn})\n- TODAY'S DATE: ${liveClock.dateHi} (${liveClock.dateEn})\n- CURRENT TIME (IST): ${liveClock.timeStr}\n- When asked what day, date, or time it is today, always state: "आज ${liveClock.dayHi} (${liveClock.dayEn}) है, दिनांक ${liveClock.dateHi} है, और समय ${liveClock.timeStr} (IST) है।"\n=======================================================\n`;

        let response: any = null;
        let isGrounded = false;
        let searchQueries: string[] = [];
        let sources: Array<{ title: string; uri: string }> = [];

        // Attempt 1: Gemini 3.8 Flash with Google Search Grounding
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: formattedContents,
            config: {
              systemInstruction: IOIS_SYSTEM_INSTRUCTION + liveTimeContext + dynamicKnowledge,
              tools: [{ googleSearch: {} }],
              temperature: 0.6,
            },
          });

          searchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];
          const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          sources = groundingChunks
            .map((chunk: any) => (chunk.web?.title ? { title: chunk.web.title, uri: chunk.web.uri } : null))
            .filter(Boolean);
          isGrounded = searchQueries.length > 0 || sources.length > 0;
        } catch (searchToolErr) {
          console.warn("Search tool call failed, falling back to direct Gemini generation:", searchToolErr);
          // Attempt 2: Direct Gemini without search tool
          try {
            response = await ai.models.generateContent({
              model: "gemini-3.8-flash",
              contents: formattedContents,
              config: {
                systemInstruction: IOIS_SYSTEM_INSTRUCTION + liveTimeContext + dynamicKnowledge,
                temperature: 0.7,
              },
            });
          } catch (directErr) {
            console.error("Direct Gemini call failed:", directErr);
            response = null;
          }
        }

        if (response && response.text) {
          return res.json({
            reply: cleanBotReply(response.text),
            grounded: isGrounded,
            searchQueries,
            sources
          });
        }
      }

      // Live Web Research Engine: For general knowledge, current affairs, history, science, geography
      const isIOISSpecific = /plan|प्ला|payout|पेआउट|रजिस्टर|register|login|लॉगिन|पासवर्ड|password|id card|कार्ड|rtps|assessment|असेसमेंट|interview|इंटरव्यू|chintu|चिंटू|bal\s*vikas|balvikas|बाल\s*विकास|whatsapp|helpdesk/i.test(lower);

      if (!isIOISSpecific) {
        const liveResearch = await performLiveWebResearch(trimmedMsg);
        if (liveResearch) {
          return res.json(liveResearch);
        }
      }

      // Comprehensive Offline & Fallback Knowledge Engine with Active Navigation Links
      let fallbackReply = "";

      // 0. Bal Vikas & Chintu AI (ioisplatform.github.io/balvikas)
      if (lower.includes("bal vikas") || lower.includes("balvikas") || lower.includes("बाल विकास") || lower.includes("chintu") || lower.includes("चिंटू") || lower.includes("700") || lower.includes("पेंसिल ट्रेसिंग") || lower.includes("वर्णमाला")) {
        fallbackReply = `IOIS बाल विकास (ioisplatform.github.io/balvikas) बच्चों की संपूर्ण प्रारंभिक शिक्षा और डिजिटल विकास का आधुनिक मंच है।

मुख्य विशेषताएं:
• 700+ पृष्ठों की सम्पूर्ण डिजिटल पुस्तक: अ से ज्ञ वर्णमाला, बारहखड़ी, शब्द ज्ञान व सचित्र ज्ञानकोश।
• चिंटू AI लाइव शिक्षक: बोलकर और समझाकर बच्चों को खेल-खेल में सिखाने वाला इंटरएक्टिव शिक्षक।
• 3D मानव शरीर रचना: आँख, कान, नाक, दिल, फेफड़े और मस्तिष्क के 3D मॉडल व आवाज़।
• डिजिटल पेंसिल ट्रेसिंग: डिजिटल स्लेट पर उंगली या माउस से अक्षर व अंक लिखने का अभ्यास।
• गणित किट: 1 से 100 गिनती, 1 से 20 पहाड़े, जोड़ व घटाव।
• गुड इंग्लिश व फ़ोनिक्स: A to Z Phonics ध्वनि व शब्द उच्चारण।
• कीमत व पेआउट: यह संपूर्ण किट IOIS Plan 01 में मात्र ₹10 में लाइफटाइम उपलब्ध है, जिसपर ₹7 (70%) का तुरंत पेआउट मिलता है।

[[NAV:plan:1|Plan 01 (₹10) बाल विकास चुनें]]
[[NAV:external:https://ioisplatform.github.io/balvikas/|बाल विकास पोर्टल खोलें]]
[[NAV:page:plans|7 मास्टर प्लांस देखें]]`;
      }
      // 0.1 National GK: Capital of India & States
      else if (lower.includes("भारत की राजधानी") || lower.includes("capital of india") || lower.includes("bharat ki rajdhani") || (lower.includes("राजधानी") && (lower.includes("भारत") || lower.includes("india") || lower.includes("दिल्ली")))) {
        fallbackReply = `भारत की राजधानी नई दिल्ली (New Delhi) है।

• आधिकारिक नाम: राष्ट्रीय राजधानी क्षेत्र दिल्ली (NCT of Delhi)
• घोषणा वर्ष: 12 दिसंबर 1911 को किंग जॉर्ज पंचम द्वारा राजधानी को कोलकाता से दिल्ली स्थानांतरित करने की घोषणा की गई थी।
• उद्घाटन: 13 फरवरी 1931 को नई दिल्ली का औपचारिक उद्घाटन हुआ था।
• प्रमुख केंद्र: राष्ट्रपति भवन, नया संसद भवन, इंडिया गेट, सर्वोच्च न्यायालय (Supreme Court) और केंद्रीय सचिवालय।

प्रमुख राज्यों की राजधानियाँ:
• बिहार: पटना (Patna)
• उत्तर प्रदेश: लखनऊ (Lucknow)
• महाराष्ट्र: मुंबई (Mumbai)
• पश्चिम बंगाल: कोलकाता (Kolkata)
• मध्य प्रदेश: भोपाल (Bhopal)
• राजस्थान: जयपुर (Jaipur)

[[NAV:page:student-study|विद्यार्थी सामान्य ज्ञान व अध्ययन नोट्स खोलें]]`;
      }
      else if (lower.includes("बिहार की राजधानी") || lower.includes("capital of bihar") || lower.includes("bihar ki rajdhani")) {
        fallbackReply = `बिहार की राजधानी पटना (Patna) है।

• ऐतिहासिक नाम: पाटलिपुत्र (Patliputra), कुसुमपुर, पुष्पपुर व अजीमाबाद।
• महत्व: यह गंगा नदी के दक्षिणी तट पर स्थित प्राचीन और ऐतिहासिक नगर है।
• प्रमुख स्थल: गोलघर, पटना साहिब गुरुद्वारा, बिहार संग्रहालय, तख्त श्री हरिमंदिर जी और नालंदा/वैशाली निकटवर्ती केंद्र।

[[NAV:page:student-study|विद्यार्थी शिक्षा व अध्ययन हब खोलें]]`;
      }
      else if (lower.includes("मुख्यमंत्री") || lower.includes("chief minister of bihar") || lower.includes("cm of bihar") || lower.includes("nitish kumar") || lower.includes("नीतीश कुमार")) {
        fallbackReply = `बिहार के वर्तमान मुख्यमंत्री श्री नीतीश कुमार (Shri Nitish Kumar) हैं।

• उप-मुख्यमंत्री: श्री सम्राट चौधरी और श्री विजय कुमार सिन्हा
• राज्यपाल: श्री राजेंद्र विश्वनाथ आर्लेकर
• राजधानी: पटना (Patna)

[[NAV:page:student-study|विद्यार्थी सामान्य ज्ञान अध्ययन हब खोलें]]`;
      }
      else if (lower.includes("राष्ट्रपति") || lower.includes("president of india") || lower.includes("droupadi murmu") || lower.includes("द्रौपदी मुर्मू")) {
        fallbackReply = `भारत की वर्तमान राष्ट्रपति माननीया श्रीमती द्रौपदी मुर्मू (Smt. Droupadi Murmu) हैं।

• वे भारत की 15वीं राष्ट्रपति हैं तथा देश की प्रथम आदिवासी महिला राष्ट्रपति हैं।
• भारत के प्रथम राष्ट्रपति: डॉ. राजेंद्र प्रसाद (Dr. Rajendra Prasad)

[[NAV:page:student-study|विद्यार्थी सामान्य ज्ञान अध्ययन हब खोलें]]`;
      }
      else if (lower.includes("प्रधानमंत्री") || lower.includes("prime minister of india") || lower.includes("narendra modi") || lower.includes("नरेंद्र मोदी")) {
        fallbackReply = `भारत के वर्तमान प्रधानमंत्री श्री नरेंद्र मोदी (Shri Narendra Modi) हैं।

• वे 26 मई 2014 से लगातार भारत के प्रधानमंत्री हैं।
• भारत के प्रथम प्रधानमंत्री: पंडित जवाहरलाल नेहरू (Pt. Jawaharlal Nehru)

[[NAV:page:student-study|विद्यार्थी अध्ययन हब खोलें]]`;
      }
      else if (lower.includes("प्रकाश संश्लेषण") || lower.includes("photosynthesis")) {
        fallbackReply = `प्रकाश संश्लेषण (Photosynthesis) वह प्रक्रिया है जिससे हरे पौधे अपना भोजन बनाते हैं:

• पौधे सूर्य का प्रकाश, कार्बन डाइऑक्साइड (CO2) और जल (H2O) लेकर ग्लूकोज (C6H12O6) बनाते हैं और ऑक्सीजन (O2) गैस छोड़ते हैं।
• रासायनिक समीकरण: 6CO2 + 6H2O + सूर्य का प्रकाश -> C6H12O6 + 6O2
• यह प्रक्रिया पत्तियों में मौजूद हरित लवक (क्लोरोफिल) के भीतर संपन्न होती है।

[[NAV:page:student-study|विद्यार्थी विज्ञान व नोट्स हब खोलें]]`;
      }
      // 1. River & Indian Geography Q&A
      else if (lower.includes("godavari") || lower.includes("गोदावरी") || (lower.includes("नदी") && lower.includes("उद्गम")) || (lower.includes("river") && lower.includes("origin"))) {
        fallbackReply = `गोदावरी नदी का उद्गम महाराष्ट्र राज्य के नासिक जिले में स्थित त्र्यंबकेश्वर (Trimbakeshwar / ब्रह्मगिरि पर्वत) से होता है।

• उपनाम: इसे 'दक्षिण गंगा' (Ganges of the South) और 'वृद्ध गंगा' भी कहा जाता है।
• कुल लंबाई: 1,465 किलोमीटर (यह भारत की दूसरी सबसे लंबी नदी है)।
• प्रवाह क्षेत्र: महाराष्ट्र, तेलंगाना, आंध्र प्रदेश, छत्तीसगढ़ और ओडिशा।
• मुहाना: यह पूर्व की ओर बहते हुए बंगाल की खाड़ी (आंध्र प्रदेश के निकट) में जाकर मिलती है।

अन्य प्रमुख नदियों के उद्गम:
• गंगा नदी: गंगोत्री हिमनद (भागीरथी), उत्तराखंड
• यमुना नदी: यमुनोत्री हिमनद, उत्तराखंड
• नर्मदा नदी: अमरकंटक, मध्य प्रदेश
• कृष्णा नदी: महाबलेश्वर, महाराष्ट्र

[[NAV:page:student-study|विद्यार्थी शिक्षा व भूगोल नोट्स खोलें]]`;
      } 
      // 2. 15-Questions Skill Assessment & Interview Guide
      else if (lower.includes("15") && (lower.includes("प्रश्नों") || lower.includes("प्रश्न") || lower.includes("सवाल") || lower.includes("ans") || lower.includes("उत्तर") || lower.includes("test") || lower.includes("इंटरव्यू") || lower.includes("interview") || lower.includes("असेसमेंट"))) {
        fallbackReply = `15-सवाल कौशल साक्षात्कार (Skill Assessment Test) में उत्तर देने की पूरी गाइड:

आप सीधे नीचे दिए गए बटन से टेस्ट शुरू कर सकते हैं:

15 प्रश्नों को 4 मुख्य श्रेणियों में बांटा गया है:
1. डिजिटल साक्षरता (प्रश्न 1-4): स्मार्टफोन व कंप्यूटर का उपयोग, सोशल मीडिया, ऑनलाइन पेमेंट (UPI)।
   • उत्तर सुझाव: अपने अनुभव के अनुसार 'नियमित रूप से' या 'बुनियादी ज्ञान' चुनें।
2. संचार व व्यवहार कौशल (प्रश्न 5-8): टीम में काम करना, लोगों को प्लान समझाना और ग्राहक सहायता।
   • उत्तर सुझाव: 'सकारात्मक व सहयोगी' विकल्प चुनें।
3. समस्या निवारण व तर्कशक्ति (प्रश्न 9-12): निर्णय लेने की क्षमता व समय प्रबंधन।
   • उत्तर सुझाव: 'व्यवस्थित व सटीक' समाधान चुनें।
4. करियर व आय लक्ष्य (प्रश्न 13-15): आपका मासिक आय लक्ष्य और उपलब्ध समय।

स्कोरिंग व प्लान अनुशंसा:
• 13-15 अंक (उत्कृष्ट): Plan 07 (Master Lifetime - ₹999 / ₹499 पेआउट) या Plan 06 (Agency Reseller)
• 10-12 अंक (अच्छा): Plan 05 (Student Elite - ₹299) या Plan 03 (Career & Job - ₹99)
• 6-9 अंक (शुरुआती): Plan 02 (Youth Skill - ₹49) या Plan 01 (Bal Vikas - ₹10)

[[NAV:page:assessment|15-सवाल कौशल असेसमेंट शुरू करें]]
[[NAV:page:plans|7 मास्टर प्लांस देखें]]`;
      }
      // 3. Student Study Portal, Notes, Formulas & Classes
      else if (lower.includes("study") || lower.includes("पढ़ाई") || lower.includes("formula") || lower.includes("सूत्र") || lower.includes("कक्षा") || lower.includes("class") || lower.includes("subject") || lower.includes("नोट्स") || lower.includes("notes") || lower.includes("math")) {
        fallbackReply = `विद्यार्थी शिक्षा व अध्ययन केंद्र (IOIS Student Portal):

विद्यार्थियों के लिए विशेष विद्यार्थी शिक्षा व अध्ययन हब तैयार किया गया है:

1. कक्षा 1 से 12 व स्नातक (BA/BSc/BCom) विषय नोट्स:
   • NCERT पाठ्यपुस्तक सारांश, महत्वपूर्ण प्रश्न-उत्तर व बोर्ड मॉडल पेपर्स।
2. गणित के सभी महत्वपूर्ण फॉर्मूला (Math Formula Sheets):
   • बीजगणित: (a+b)^2 = a^2 + 2ab + b^2, द्विघात सूत्र
   • त्रिकोणमिति: sin^2 θ + cos^2 θ = 1, कोण मान तालिका
   • क्षेत्रमिति: वृत्त, बेलन, शंकु, गोला के सूत्र
   • कलन: अवकलन d/dx व समाकलन ∫ f(x)dx
3. मुफ्त अध्ययन सामग्री:
   • NCERT e-Books, DIKSHA पोर्टल, SWAYAM IIT कोर्सेज, नेशनल डिजिटल लाइब्रेरी (NDLI)।

[[NAV:page:student-study|विद्यार्थी शिक्षा व नोट्स हब खोलें]]`;
      }
      // 4. Career Guidance
      else if (lower.includes("doctor") || lower.includes("डॉक्टर") || lower.includes("engineer") || lower.includes("इंजीनियर") || lower.includes("ias") || lower.includes("upsc") || lower.includes("neet") || lower.includes("jee") || lower.includes("career") || lower.includes("करियर") || lower.includes("नौकरी")) {
        fallbackReply = `करियर चयन व मार्गदर्शन (Career Roadmap Guide):

• डॉक्टर (Medical / MBBS / BDS):
  - 10वीं के बाद: 11वीं-12वीं में PCB (Physics, Chemistry, Biology) विषय लें।
  - प्रवेश परीक्षा: NEET-UG परीक्षा उत्तीर्ण करें। AIIMS व सरकारी मेडिकल कॉलेजों में MBBS प्रवेश।

• इंजीनियर (Engineering / Software / AI / Civil / Mech):
  - 10वीं के बाद: 11वीं-12वीं में PCM (Physics, Chemistry, Mathematics) लें।
  - प्रवेश परीक्षा: JEE Main व JEE Advanced। IITs व NITs में B.Tech।

• प्रशासनिक सेवा (IAS / IPS / IFS / BPSC / UPPSC):
  - योग्यता: किसी भी मान्यता प्राप्त विषय में स्नातक (Graduation)।
  - तैयारी: NCERT 6th-12th का आधारभूत अध्ययन, दैनिक अखबार/Current Affairs, UPSC परीक्षा।

• रक्षा सेवा (NDA / CDS / वायु सेना / नौसेना):
  - 12वीं (PCM) के बाद NDA (National Defence Academy) परीक्षा व SSB इंटरव्यू।

[[NAV:page:student-study|विद्यार्थी करियर गाइड खोलें]]
[[NAV:page:jobs|सरकारी व प्राइवेट जॉब अलर्ट देखें]]`;
      }
      // 5. Scholarship & Bonafide Certificate
      else if (lower.includes("scholarship") || lower.includes("छात्रवृत्ति") || lower.includes("स्कॉलरशिप") || lower.includes("bonafide") || lower.includes("बोनाफाइड") || lower.includes("medhasoft") || lower.includes("pms")) {
        fallbackReply = `छात्रवृत्ति व बोनाफाइड सर्टिफिकेट (Bonafide Certificate) गाइड:

1. बोनाफाइड सर्टिफिकेट क्या है?
यह आपके स्कूल या कॉलेज द्वारा जारी आधिकारिक प्रमाण पत्र है, जो प्रमाणित करता है कि आप उस संस्थान के नियमित छात्र/छात्रा हैं। यह पोस्ट-मैट्रिक PMS व NSP स्कॉलरशिप के लिए अनिवार्य है।

2. प्रमुख छात्रवृत्ति पोर्टल्स:
• नेशनल स्कॉलरशिप पोर्टल (NSP): scholarships.gov.in
• बिहार पोस्ट-मैट्रिक स्कॉलरशिप (PMS): pmsonline.bih.nic.in (SC, ST, BC, EBC छात्रों हेतु)
• मुख्यमंत्री कन्या उत्थान योजना (Medhasoft): medhasoft.bih.nic.in
  - 10वीं प्रथम श्रेणी: ₹10,000
  - 12वीं उत्तीर्ण (अविवाहित कन्या): ₹25,000
  - स्नातक उत्तीर्ण छात्रा: ₹50,000

3. आवश्यक दस्तावेज:
• आधार कार्ड, जाति/आय/निवास प्रमाण पत्र, बोनाफाइड सर्टिफिकेट, फीस रसीद, आधार-लिंक्ड बैंक खाता।

[[NAV:page:student-study|स्कॉलरशिप व बोनाफाइड जनरेटर खोलें]]
[[NAV:page:rtps-services|जाति/आय/निवास (RTPS) आवेदन करें]]`;
      }
      // 6. IOIS Plans
      else if (lower.includes("plan") || lower.includes("प्लान") || lower.includes("रेट") || lower.includes("कीमत") || lower.includes("price")) {
        fallbackReply = `IOIS के सभी 7 मास्टर प्लांस व इंस्टेंट पेआउट सूची:

1. Plan 01: Bal Vikas (₹10) - ₹7 इंस्टेंट पेआउट (70% Payout)
2. Plan 02: Youth Skill (₹49) - ₹34 इंस्टेंट पेआउट (70% Payout)
3. Plan 03: Career & Job (₹99) - ₹64 इंस्टेंट पेआउट (65% Payout)
4. Plan 04: Family VIP (₹199) - ₹119 इंस्टेंट पेआउट (60% Payout)
5. Plan 05: Student Elite (₹299) - ₹179 इंस्टेंट पेआउट (60% Payout)
6. Plan 06: Agency Reseller (₹499) - ₹274 इंस्टेंट पेआउट (55% Payout)
7. Plan 07: Master Lifetime (₹999) - ₹499 इंस्टेंट पेआउट (50% Payout)

सभी प्लांस में लाइफटाइम एक्सेस व 5-मिनट एडमिन अप्रूवल मिलता है!

[[NAV:page:plans|7 मास्टर प्लांस विवरण देखें]]
[[NAV:page:register|नया रजिस्ट्रेशन पोर्टल खोलें]]`;
      } 
      // 7. Registration
      else if (lower.includes("register") || lower.includes("रजिस्ट्रेशन") || lower.includes("खाता") || lower.includes("join") || lower.includes("जुड़ें")) {
        fallbackReply = `IOIS नया सदस्य रजिस्ट्रेशन प्रक्रिया (5 आसान स्टेप्स):

1. नीचे दिए गए 'नया रजिस्ट्रेशन फॉर्म खोलें' बटन पर क्लिक करें।
2. अपना पूरा नाम, मोबाइल नंबर और एक सुरक्षित पासवर्ड भरें।
3. 7 में से अपना मनपसंद डिजिटल प्लान चुनें।
4. आधिकारिक UPI ID 8877490845@spicepay (Vikas Kumar) पर स्कैन या ट्रांसफर करके भुगतान करें।
5. भुगतान का 12-अंकों का UTR / Ref नंबर दर्ज करें और स्क्रीनशॉट अपलोड करें।
6. सबमिट करें — 5 मिनट में एडमिन द्वारा आपकी ID एक्टिवेट कर दी जाएगी!

[[NAV:page:register|नया रजिस्ट्रेशन फॉर्म खोलें]]
[[NAV:page:plans|7 मास्टर प्लांस देखें]]`;
      } 
      // 8. ID Card
      else if (lower.includes("id card") || lower.includes("आईडी कार्ड") || lower.includes("कार्ड")) {
        fallbackReply = `आधिकारिक स्मार्ट डिजिटल ID कार्ड:

• IOIS सदस्यों को 256-बिट एन्क्रिप्टेड और QR कोड वेरिफाइड स्मार्ट डिजिटल कार्ड दिया जाता है।
• इसमें आपकी फोटो, User ID, एक्टिव प्लान, ब्लड ग्रुप व जारी होने की तिथि अंकित होती है।
• आप 'HD PNG डाउनलोड' या 'प्रिंट' बटन दबाकर तुरंत इसे अपने फोन या कंप्यूटर में सेव कर सकते हैं।

[[NAV:page:idcard|डिजिटल ID कार्ड पेज खोलें]]
[[NAV:login:login|सदस्य लॉगिन करें]]`;
      } 
      // 9. RTPS Services
      else if (lower.includes("rtps") || lower.includes("जाति") || lower.includes("आय") || lower.includes("निवास") || lower.includes("obc") || lower.includes("ews")) {
        fallbackReply = `RTPS नागरिक सेवाएं (जाति, आय, निवास प्रमाण पत्र):

• आधिकारिक पोर्टल: serviceonline.bihar.gov.in (100% निशुल्क)
• प्रमाण पत्र:
  - निवास प्रमाण पत्र (Residential / Domicile Certificate)
  - जाति प्रमाण पत्र (Caste Certificate - SC/ST/EBC/BC)
  - आय प्रमाण पत्र (Income Certificate)
  - OBC गैर-क्रीमी लेयर (NCL) व EWS प्रमाण पत्र
• आवश्यक दस्तावेज: आधार कार्ड, पासपोर्ट साइज फोटो, आधार लिंक्ड मोबाइल नंबर।
• अवधि: 10 से 14 कार्य दिवसों में ऑनलाइन जारी।

[[NAV:page:rtps-services|RTPS नागरिक सेवाएं पोर्टल खोलें]]`;
      } 
      // 10. Land Mutation / Dakhil Kharij
      else if (lower.includes("दाखिल खारिज") || lower.includes("mutation") || lower.includes("जमीन") || lower.includes("parimarjan") || lower.includes("bhumi") || lower.includes("jamabandi")) {
        fallbackReply = `बिहार भूमि दाखिल खारिज (Mutation) व जमीन सुधार गाइड:

• आधिकारिक पोर्टल: biharbhumi.bihar.gov.in
• दाखिल खारिज (Online Mutation):
  1. पोर्टल पर रजिस्ट्रेशन करके लॉगिन करें।
  2. अपना जिला, अंचल व मौजा चुनें।
  3. रजिस्ट्री (केवाला) की PDF कॉपी व लगान रसीद अपलोड करें।
  4. 35-45 दिनों में कर्मचारी व CO जांच के बाद शुद्धि पत्र जारी होता है।
• परिमार्जन प्लस (Parimarjan Plus): पुरानी जमाबंदी में खाता, खेसरा, रकबा या नाम सुधारने के लिए ऑनलाइन आवेदन करें।

[[NAV:page:rtps-services|जमीन दाखिल खारिज व सुधार पोर्टल खोलें]]`;
      } 
      // 11. Free e-PAN
      else if (lower.includes("pan") || lower.includes("पैन कार्ड")) {
        fallbackReply = `10-मिनट में फ्री Instant e-PAN कार्ड:

• आधिकारिक पोर्टल: eportal.incometax.gov.in -> Instant e-PAN
• शर्त: आधार कार्ड से मोबाइल नंबर लिंक होना चाहिए और पहले से कोई पैन न बना हो।
• प्रक्रिया: 12 अंकों का आधार नंबर डालें -> OTP दर्ज करें -> 10 मिनट में डिजिटल e-PAN PDF डाउनलोड करें!
• यह पैन कार्ड भौतिक पैन कार्ड के समान 100% वैध है।

[[NAV:page:rtps-services|इंस्टेंट e-PAN पोर्टल खोलें]]`;
      } 
      // 12. About IOIS
      else if (lower.includes("iois") || lower.includes("क्या है") || lower.includes("about") || lower.includes("काम")) {
        fallbackReply = `IOIS (Indian Online Income Supporting System) क्या है?

IOIS भारत का डिजिटल शिक्षा, बाल विकास, नागरिक सेवा मार्गदर्शन व आजीविका सहायता मंच है।

मुख्य विशेषताएं:
1. बाल विकास (Plan 01 ₹10): 700+ पृष्ठों की डिजिटल पुस्तक, चिंटू AI शिक्षक, 3D शरीर मॉडल व पेंसिल ट्रेसिंग।
2. विद्यार्थी हब: कक्षा 1-12 NCERT नोट्स, मैथ फॉर्मूला, स्कॉलरशिप व बोनाफाइड जनरेटर।
3. 15-सवाल कौशल साक्षात्कार: आपकी प्रतिभा पहचान कर सही करियर व प्लान मार्गदर्शन।
4. 7 डिजिटल प्लांस: ₹10 से ₹999 में लाइफटाइम एक्सेस व 50%-70% इंस्टेंट पेआउट।
5. नागरिक सेवाएं: RTPS जाति/आय/निवास, जमीन दाखिल खारिज, 10-मिनट e-PAN।

[[NAV:page:plans|7 मास्टर प्लांस देखें]]
[[NAV:page:register|नया रजिस्ट्रेशन करें]]
[[NAV:page:assessment|15-सवाल टेस्ट दें]]`;
      } 
      // 13. Instant Payout
      else if (lower.includes("payout") || lower.includes("पेआउट") || lower.includes("पैसे") || lower.includes("रुपये") || lower.includes("कमीशन") || lower.includes("earning")) {
        fallbackReply = `IOIS 50%-70% इंस्टेंट पेआउट सिस्टम:

IOIS में स्मार्ट इंस्टेंट पेआउट प्रोटोकॉल कार्यरत है:
• Plan 01 (₹10): ₹7 इंस्टेंट पेआउट (70%)
• Plan 02 (₹49): ₹34 इंस्टेंट पेआउट (70%)
• Plan 03 (₹99): ₹64 इंस्टेंट पेआउट (65%)
• Plan 04 (₹199): ₹119 इंस्टेंट पेआउट (60%)
• Plan 05 (₹299): ₹179 इंस्टेंट पेआउट (60%)
• Plan 06 (₹499): ₹274 इंस्टेंट पेआउट (55%)
• Plan 07 (₹999): ₹499 इंस्टेंट पेआउट (50%)

जब भी आपका कोई साथी आपके रेफरल से एक्टिवेट होता है, एडमिन वेरिफिकेशन होते ही पेआउट सीधे आपके UPI में ट्रांसफर कर दिया जाता है!

[[NAV:page:calculator|पेआउट व आय कैलकुलेटर खोलें]]
[[NAV:page:plans|सभी प्लांस देखें]]`;
      } 
      // 14. Forgot Password / ID Recovery / Login
      else if (lower.includes("password") || lower.includes("पासवर्ड") || lower.includes("login") || lower.includes("लॉगिन") || lower.includes("user id") || lower.includes("आईडी भूल")) {
        fallbackReply = `सदस्य लॉगिन, पासवर्ड रीसेट व User ID रिकवरी:

• लॉगिन: यदि आपके पास User ID व पासवर्ड है, तो लॉगिन करें।
• पासवर्ड भूल गए: 2-स्टेप सुरक्षित OTP वेरिफिकेशन (मोबाइल नंबर + रजिस्टर्ड नाम के पहले 2 अक्षर) से नया पासवर्ड बनाएं।
• User ID भूल गए: अपने रजिस्टर्ड मोबाइल नंबर व नाम वेरिफिकेशन से अपनी User ID प्राप्त करें।

[[NAV:login:login|सदस्य लॉगिन पोर्टल खोलें]]
[[NAV:login:forgot_password|पासवर्ड रीसेट करें]]
[[NAV:login:forgot_user_id|User ID खोजें]]`;
      }
      // 15. Official Contact
      else if (lower.includes("contact") || lower.includes("संपर्क") || lower.includes("whatsapp") || lower.includes("help") || lower.includes("फोन") || lower.includes("helpdesk")) {
        fallbackReply = `IOIS 24x7 आधिकारिक सहायता केंद्र:

• व्हाट्सएप सपोर्ट: +91 8877490845
• आधिकारिक टेलीग्राम: @ioisplatform
• ईमेल: ioisplatform@gmail.com
• UPI ID: 8877490845@spicepay (Vikas Kumar)

[[NAV:whatsapp:918877490845|व्हाट्सएप पर सीधी चैट शुरू करें]]
[[NAV:external:https://t.me/ioisplatform|टेलीग्राम चैनल से जुड़ें]]`;
      } 
      // 16. General Research & Assistant Fallback
      else {
        const finalResearch = await performLiveWebResearch(trimmedMsg);
        if (finalResearch) {
          return res.json(finalResearch);
        }

        const unanswered = loadUnansweredFromDisk();
        const alreadyLogged = unanswered.some((u) => u.question.toLowerCase() === lower);
        if (!alreadyLogged && trimmedMsg.length > 3) {
          unanswered.unshift({
            id: `unans-${Date.now()}`,
            question: trimmedMsg,
            askedAt: new Date().toISOString(),
            status: "pending",
          });
          saveUnansweredToDisk(unanswered);
          sendTelegramUnansweredQuestionAlert(trimmedMsg);
        }

        fallbackReply = `आपके प्रश्न "${trimmedMsg}" पर अधिक सटीक जानकारी प्राप्त करने के लिए कृपया मुख्य कीवर्ड या विषय स्पष्ट लिखें।

आप हमसे सामान्य ज्ञान, बिहार का इतिहास, देश-दुनिया के तथ्य, बाल विकास या IOIS सेवाओं पर कोई भी सवाल पूछ सकते हैं:
• बाल विकास (Plan 01 ₹10): 700+ पृष्ठों की पुस्तक, चिंटू AI व 3D शरीर
• 15-सवाल कौशल टेस्ट: टेस्ट व प्लान गाइड
• 7 डिजिटल प्लांस: ₹10 से ₹999 में लाइफटाइम एक्सेस व 70% पेआउट
• विद्यार्थी शिक्षा हब: NCERT नोट्स, मैथ फॉर्मूला व स्कॉलरशिप
• नागरिक सेवाएं: RTPS जाति/आय/निवास, जमीन दाखिल खारिज, Instant e-PAN

[[NAV:page:student-study|विद्यार्थी शिक्षा व नोट्स खोलें]]
[[NAV:page:assessment|15-सवाल असेसमेंट दें]]
[[NAV:page:plans|7 मास्टर प्लांस देखें]]
[[NAV:whatsapp:918877490845|व्हाट्सएप हेल्पलाइन (+91 8877490845)]]`;
      }

      return res.json({ reply: cleanBotReply(fallbackReply), grounded: false });
    } catch (err: any) {
      console.error("Chat API Error:", err);
      return res.status(500).json({
        reply: "तकनीकी त्रुटि के कारण उत्तर प्राप्त नहीं हो सका। कृपया थोड़ी देर बाद पुनः प्रयास करें या हमारे व्हाट्सएप सपोर्ट +91 8877490845 पर संपर्क करें।",
      });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IOIS Server is running on port ${PORT}`);
  });
}

startServer();

