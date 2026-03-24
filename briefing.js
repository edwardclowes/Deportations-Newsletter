#!/usr/bin/env node
/**
 * Immigration & DHS Daily Briefing
 * Searches for ICE, third-country deportations, and DHS policy news
 * then emails a formatted briefing via Gmail (nodemailer).
 *
 * Usage:  node briefing.js
 * Cron:   0 7 * * * cd /path/to/project && node briefing.js
 */

import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;
const GMAIL_USER      = process.env.GMAIL_USER;
const GMAIL_APP_PASS  = process.env.GMAIL_APP_PASS;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;

for (const [k, v] of Object.entries({ RECIPIENT_EMAIL, GMAIL_USER, GMAIL_APP_PASS, ANTHROPIC_KEY })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
}

// ─── Topics ───────────────────────────────────────────────────────────────────
const TOPICS = [
  {
    id: "ice",
    label: "ICE Operations",
    query: "US Immigration ICE operations arrests deportations raids 2026",
  },
  {
    id: "third_country",
    label: "Third-Country Deportations",
    query: "US third country deportations El Salvador Mexico Rwanda agreement 2026",
  },
  {
    id: "dhs",
    label: "DHS Policy Changes",
    query: "US Department of Homeland Security policy immigration rule change announcement 2026",
  },
];

// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

/**
 * Strip <cite index="...">...</cite> tags that Claude's web search injects.
 */
function stripCitations(str = "") {
  return String(str)
    .replace(/<cite[^>]*>/g, "")
    .replace(/<\/cite>/g, "")
    .trim();
}

/**
 * Fetch news for a single topic using Claude + web_search tool.
 * Returns { summary, stories: [{ headline, source, url, detail, significance }] }
 */
async function fetchTopic(topic) {
  console.log(`  → Searching: ${topic.label}`);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: `You are a concise, factual news briefing writer. Use web search to find the latest news (last 24-48 hours if possible) on the given topic. Return ONLY a valid JSON object with NO markdown fencing, NO preamble, NO citation tags:
{
  "summary": "2-3 sentence overview of the current situation",
  "stories": [
    {
      "headline": "Specific story headline",
      "source": "Publication name",
      "url": "https://full-url-to-the-article.com",
      "detail": "1-2 sentence factual description",
      "significance": "One sentence on why this matters"
    }
  ]
}
Include 2-4 of the most significant stories. Be factual and neutral. Always include the full URL for each story.`,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: `Find the very latest news about: ${topic.query}` }],
  });

  // Extract the final text block (after tool use)
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    // Strip any citation markup that leaked into text fields
    parsed.summary = stripCitations(parsed.summary);
    parsed.stories = (parsed.stories || []).map((s) => ({
      ...s,
      headline:    stripCitations(s.headline),
      source:      stripCitations(s.source),
      detail:      stripCitations(s.detail),
      significance: stripCitations(s.significance),
    }));
    return parsed;
  } catch {
    return { summary: stripCitations(text.slice(0, 400)), stories: [] };
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Email builders ───────────────────────────────────────────────────────────
function buildHtml(results) {
  const date = formatDate();

  const sections = results.map(({ topic, data }) => {
    const stories = (data.stories || []).map((s) => `
      <div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #ede8df;">
        ${s.url
          ? `<a href="${esc(s.url)}" style="font-size:14px;font-weight:700;color:#1a1a1a;text-decoration:none;display:block;margin-bottom:3px;">${esc(s.headline)}</a>`
          : `<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:3px;">${esc(s.headline)}</div>`}
        <div style="font-size:10px;color:#999;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">
          ${s.url ? `<a href="${esc(s.url)}" style="color:#999;text-decoration:none;">${esc(s.source)}</a>` : esc(s.source)}
        </div>
        <div style="font-size:13px;color:#444;line-height:1.6;">${esc(s.detail)}</div>
        ${s.significance ? `<div style="font-size:12px;color:#888;font-style:italic;margin-top:4px;">→ ${esc(s.significance)}</div>` : ""}
        ${s.url ? `<div style="margin-top:8px;"><a href="${esc(s.url)}" style="font-size:11px;color:#888;text-decoration:underline;">Read more →</a></div>` : ""}
      </div>`).join("");

    return `
      <div style="padding:28px 40px;border-bottom:1px solid #e8e3d8;">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#aaa;margin-bottom:10px;">${esc(topic.label)}</div>
        ${data.summary ? `<div style="font-size:14px;line-height:1.7;color:#333;border-left:3px solid #1a1a1a;padding-left:14px;margin-bottom:20px;">${esc(data.summary)}</div>` : ""}
        ${stories}
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Immigration &amp; DHS Briefing — ${date}</title></head>
<body style="margin:0;padding:0;background:#f4f0e8;font-family:Georgia,serif;">
  <div style="max-width:620px;margin:24px auto;background:#fff;border:1px solid #ddd;">
    <div style="background:#1a1a1a;color:#f4f0e8;padding:32px 40px;">
      <div style="font-size:9px;letter-spacing:5px;text-transform:uppercase;opacity:.5;margin-bottom:8px;">Daily Intelligence</div>
      <div style="font-size:26px;font-weight:700;margin-bottom:6px;">Immigration &amp; DHS Briefing</div>
      <div style="font-size:12px;opacity:.45;">${date}</div>
    </div>
    ${sections}
    <div style="padding:20px 40px;text-align:center;font-size:10px;color:#bbb;background:#f9f6f0;">
      Generated by your automated Immigration &amp; DHS Briefing · ${date}
    </div>
  </div>
</body></html>`;
}

function buildText(results) {
  const date = formatDate();
  let out = `IMMIGRATION & DHS BRIEFING — ${date}\n${"=".repeat(52)}\n\n`;
  for (const { topic, data } of results) {
    out += `${topic.label.toUpperCase()}\n${"-".repeat(topic.label.length)}\n`;
    if (data.summary) out += `${data.summary}\n\n`;
    for (const s of data.stories || []) {
      out += `• ${s.headline} (${s.source})\n  ${s.detail}\n`;
      if (s.significance) out += `  → ${s.significance}\n`;
      if (s.url) out += `  ${s.url}\n`;
      out += "\n";
    }
    out += "\n";
  }
  return out;
}

function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Send email ───────────────────────────────────────────────────────────────
async function sendEmail(htmlBody, textBody) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
  });

  const info = await transporter.sendMail({
    from: `"DHS Briefing Bot" <${GMAIL_USER}>`,
    to: RECIPIENT_EMAIL,
    subject: `Immigration & DHS Briefing — ${formatDate()}`,
    text: textBody,
    html: htmlBody,
  });

  console.log(`  → Email sent: ${info.messageId}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nImmigration & DHS Briefing — ${formatDate()}`);
  console.log("Fetching news...\n");

  const results = [];
  for (const topic of TOPICS) {
    try {
      const data = await fetchTopic(topic);
      results.push({ topic, data });
    } catch (err) {
      console.error(`  ✗ Failed to fetch "${topic.label}":`, err.message);
      results.push({ topic, data: { summary: "Could not retrieve stories for this topic.", stories: [] } });
    }
  }

  console.log("\nBuilding and sending email...");
  await sendEmail(buildHtml(results), buildText(results));

  console.log("\n✓ Done.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
