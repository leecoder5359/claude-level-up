#!/usr/bin/env node
// UserPromptSubmit hook: surface relevant *curated* agentmemory memories for
// the current prompt and inject them as additionalContext.
//
// Why this exists: the upstream agentmemory plugin's prompt-submit hook only
// RECORDS the prompt (POST /agentmemory/observe) — it never recalls. And the
// engine's BM25/hybrid search ranks this session's own raw observations
// (every prompt_submit + tool call) above curated memories for short queries,
// so a naive /search injects noise, not knowledge.
//
// Instead we read the curated memory store (GET /agentmemory/memories) and rank
// it client-side with a whitespace-insensitive longest-common-substring score.
// That defeats the Korean spacing problem ("루프엔지니어링" vs "루프 엔지니어링")
// that token search misses, and never surfaces observation noise.
//
// Fails open: any error/timeout/empty result exits 0 with no output, so a down
// memory server never blocks a prompt.

const REST_URL = process.env["AGENTMEMORY_URL"] || "http://localhost:3111";
const SECRET = process.env["AGENTMEMORY_SECRET"] || "";
const POOL = Number(process.env["AGENTMEMORY_RECALL_POOL"] || 60); // memories scanned
const MAX_ITEMS = Number(process.env["AGENTMEMORY_RECALL_MAX"] || 5);
const MIN_OVERLAP = Number(process.env["AGENTMEMORY_RECALL_MIN_OVERLAP"] || 4);
// Per-item cap is generous enough to carry a full saved memory (the longest are
// ~1k chars) so structured notes don't get cut mid-section. A total budget keeps
// the overall injection bounded when several memories match.
const MAX_ITEM_CHARS = Number(process.env["AGENTMEMORY_RECALL_ITEM_CHARS"] || 1200);
const TOTAL_BUDGET = Number(process.env["AGENTMEMORY_RECALL_BUDGET"] || 3000);
const LCS_CAP = 1200; // cap text length fed to the O(n*m) LCS to bound cost

function authHeaders() {
  const h = {};
  if (SECRET) h["Authorization"] = `Bearer ${SECRET}`;
  return h;
}

// Lowercase and strip everything except letters/numbers (incl. Hangul), so
// "루프엔지니어링이 뭐야" and "루프 엔지니어링(Loop Engineering)" share a long substring.
function norm(s) {
  return (s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// Length of the longest common substring between a and b (DP, rolling row).
function lcsLen(a, b) {
  if (!a || !b) return 0;
  a = a.slice(0, LCS_CAP);
  b = b.slice(0, LCS_CAP);
  const n = a.length, m = b.length;
  let prev = new Int32Array(m + 1), cur = new Int32Array(m + 1), best = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        const v = prev[j - 1] + 1;
        cur[j] = v;
        if (v > best) best = v;
      } else cur[j] = 0;
    }
    [prev, cur] = [cur, prev];
  }
  return best;
}

function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  const prompt = clean(data.prompt ?? data.userPrompt ?? "");
  if (prompt.length < 4) return;
  const qn = norm(prompt);
  if (qn.length < 3) return;

  let json;
  try {
    const res = await fetch(`${REST_URL}/agentmemory/memories?limit=${POOL}`, {
      method: "GET",
      headers: authHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return;
    json = await res.json();
  } catch {
    return; // server down / timeout / unauthorized -> fail open
  }

  const memories = Array.isArray(json?.memories) ? json.memories : [];
  const scored = [];
  for (const mem of memories) {
    const body = clean(mem?.content || mem?.title);
    if (!body) continue;
    const hay = norm(`${mem?.title || ""} ${mem?.content || ""} ${(mem?.concepts || []).join(" ")}`);
    const overlap = lcsLen(qn, hay);
    if (overlap < MIN_OVERLAP) continue;
    scored.push({ body, overlap, strength: Number(mem?.strength || 0) });
  }

  if (scored.length === 0) return;
  scored.sort((a, b) => b.overlap - a.overlap || b.strength - a.strength);

  const lines = [];
  const seen = new Set();
  let used = 0;
  for (const s of scored.slice(0, MAX_ITEMS)) {
    let text = s.body;
    const key = norm(text).slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    // Cap each item, then fit it within the remaining total budget so a long
    // top match is never cut mid-section while later weaker matches still bloat.
    const room = Math.min(MAX_ITEM_CHARS, TOTAL_BUDGET - used);
    if (room < 40) break; // not enough budget left for a meaningful item
    if (text.length > room) text = text.slice(0, room) + "…";
    lines.push(`- ${text}`);
    used += text.length;
  }
  if (lines.length === 0) return;

  const context =
    "<agentmemory-recall>\n" +
    "Relevant saved memories for this prompt (background context — reflects what " +
    "was true when written; verify specifics before relying on them):\n" +
    lines.join("\n") +
    "\n</agentmemory-recall>";

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: context,
      },
    })
  );
}

main().catch(() => {});
