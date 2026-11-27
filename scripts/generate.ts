// Generates the profile README sections and pixel-art SVG cards.
// Run: GITHUB_TOKEN=... bun scripts/generate.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const cfg = JSON.parse(readFileSync("profile.config.json", "utf8"));
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required");

const P = { base: "#191724", surface: "#1f1d2e", overlay: "#26233a", hl: "#403d52", muted: "#6e6a86", subtle: "#908caa", text: "#e0def4", love: "#eb6f92", gold: "#f6c177", rose: "#ebbcba", pine: "#31748f", foam: "#9ccfd8", iris: "#c4a7e7" };

// ---------- data ----------
async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: "bearer " + token, "Content-Type": "application/json", "User-Agent": "profile-readme-generator" },
    body: JSON.stringify({ query, variables }),
  });
  const json: any = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const userData = (await gql(
  "query($login:String!){ user(login:$login){ followers{totalCount} contributionsCollection{ totalCommitContributions totalPullRequestContributions contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount contributionLevel } } } } } }",
  { login: cfg.login },
)).user;

type Repo = { name: string; url: string; description: string | null; isArchived: boolean; stargazerCount: number; primaryLanguage: { name: string; color: string } | null; pushedAt: string };
const repos: Repo[] = [];
let cursor: string | null = null;
do {
  const d: any = await gql(
    "query($login:String!,$cursor:String){ user(login:$login){ repositories(first:100, after:$cursor, privacy:PUBLIC, isFork:false, ownerAffiliations:OWNER, orderBy:{field:PUSHED_AT,direction:DESC}){ pageInfo{hasNextPage endCursor} nodes{ name url description isArchived stargazerCount primaryLanguage{name color} pushedAt } } } }",
    { login: cfg.login, cursor },
  );
  const page = d.user.repositories;
  repos.push(...page.nodes);
  cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
} while (cursor);

const featured = await Promise.all(cfg.featured.map(async (f: any) => {
  const [owner, name] = f.repo.split("/");
  const d = await gql("query($o:String!,$n:String!){ repository(owner:$o,name:$n){ name url description stargazerCount primaryLanguage{name color} } }", { o: owner, n: name });
  return { ...d.repository, name: f.name ?? d.repository.name, description: f.description ?? d.repository.description };
}));

const days: { date: string; count: number; level: number }[] = userData.contributionsCollection.contributionCalendar.weeks
  .flatMap((w: any) => w.contributionDays)
  .map((d: any) => ({ date: d.date, count: d.contributionCount, level: ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"].indexOf(d.contributionLevel) }));

function streaks() {
  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, current = 0;
  if (days[i]?.count === 0) i--; // today may not have activity yet
  for (; i >= 0 && days[i].count > 0; i--) current++;
  return { current, longest };
}
const { current, longest } = streaks();
const starCount = repos.reduce((s, r) => s + r.stargazerCount, 0) ;

const fmt = (n: number) => (n >= 10000 ? Math.round(n / 1000) + "K" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n));
const stats = [
  { label: "CONTRIBUTIONS", sub: "past year", value: fmt(userData.contributionsCollection.contributionCalendar.totalContributions), color: P.foam },
  { label: "STREAK", sub: "best " + longest + " days", value: current + "D", color: P.gold },
  { label: "STARS", sub: "on my repos", value: fmt(starCount), color: P.love },
  { label: "REPOS", sub: "public", value: fmt(repos.length), color: P.iris },
  { label: "FOLLOWERS", sub: "on GitHub", value: fmt(userData.followers.totalCount), color: P.rose },
];

// top languages across public repos pushed in the last 2 years
const since = Date.now() - 2 * 365 * 864e5;
const langCount = new Map<string, { n: number; color: string }>();
for (const r of repos) {
  if (!r.primaryLanguage || Date.parse(r.pushedAt) < since) continue;
  const e = langCount.get(r.primaryLanguage.name) ?? { n: 0, color: r.primaryLanguage.color };
  e.n++; langCount.set(r.primaryLanguage.name, e);
}
const langs = [...langCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
const langTotal = langs.reduce((s, [, v]) => s + v.n, 0);


// ---------- 5x7 pixel font ----------
const FONT: Record<string, string[]> = {
  A: ["01110","10001","10001","11111","10001","10001","10001"], B: ["11110","10001","10001","11110","10001","10001","11110"],
  C: ["01111","10000","10000","10000","10000","10000","01111"], D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"], F: ["11111","10000","10000","11110","10000","10000","10000"],
  G: ["01111","10000","10000","10011","10001","10001","01111"], H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["11111","00100","00100","00100","00100","00100","11111"], J: ["00111","00010","00010","00010","00010","10010","01100"],
  K: ["10001","10010","10100","11000","10100","10010","10001"], L: ["10000","10000","10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10101","10001","10001","10001"], N: ["10001","11001","10101","10011","10001","10001","10001"],
  O: ["01110","10001","10001","10001","10001","10001","01110"], P: ["11110","10001","10001","11110","10000","10000","10000"],
  Q: ["01110","10001","10001","10001","10101","10010","01101"], R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"], T: ["11111","00100","00100","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","10001","10001","01110"], V: ["10001","10001","10001","10001","10001","01010","00100"],
  W: ["10001","10001","10001","10101","10101","10101","01010"], X: ["10001","10001","01010","00100","01010","10001","10001"],
  Y: ["10001","10001","01010","00100","00100","00100","00100"], Z: ["11111","00001","00010","00100","01000","10000","11111"],
  "0": ["01110","10011","10101","10101","10101","11001","01110"], "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"], "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"], "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"], "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"], "9": ["01110","10001","10001","01111","00001","00010","01100"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"], ".": ["00000","00000","00000","00000","00000","01100","01100"],
  "-": ["00000","00000","00000","01110","00000","00000","00000"], "+": ["00000","00100","00100","11111","00100","00100","00000"],
};
const textWidth = (s: string, px: number) => s.length * 6 * px - px;
// Returns rects; each glyph is a <g> so it can be animated on its own.
function pixelText(s: string, x: number, y: number, px: number, opts: { cls?: string; fill?: string; anim?: (i: number) => string } = {}) {
  return [...s].map((ch, i) => {
    const g = FONT[ch.toUpperCase()] ?? FONT[" "];
    let r = "";
    g.forEach((row, ry) => [...row].forEach((b, rx) => { if (b === "1") r += '<rect x="' + (x + (i * 6 + rx) * px) + '" y="' + (y + ry * px) + '" width="' + px + '" height="' + px + '"/>'; }));
    return '<g' + (opts.cls ? ' class="' + opts.cls + '"' : "") + (opts.fill ? ' fill="' + opts.fill + '"' : "") + (opts.anim ? ' style="' + opts.anim(i) + '"' : "") + ">" + r + "</g>";
  }).join("");
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// Pixel sprite from a string grid: "." empty, other chars map to colors.
function sprite(rows: string[], x: number, y: number, px: number, colors: Record<string, string>) {
  let r = "";
  rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (colors[c]) r += '<rect x="' + (x + rx * px) + '" y="' + (y + ry * px) + '" width="' + px + '" height="' + px + '" fill="' + colors[c] + '"/>'; }));
  return r;
}
const HEART = [".LL.LL.", "LLLLLLL", "LLLLLLL", ".LLLLL.", "..LLL..", "...L..."];
// A small original pixel rocket, pointing right.
const ROCKET = ["..WW....", ".WWWWW..", "FWWBBWWN", "FWWBBWWN", ".WWWWW..", "..WW...."];

// Every animation fills "backwards" only, so the resting state is fully drawn
// for clients that do not animate.
const BASE_CSS = "@keyframes pop{from{opacity:0;transform:translateY(-6px)}}@keyframes fade{from{opacity:0}}@keyframes tw{50%{opacity:.25}}@keyframes blink{50%{opacity:0}}@keyframes beat{50%{transform:scale(1.18)}}@keyframes hue{0%,100%{fill:" + P.iris + "}33%{fill:" + P.foam + "}66%{fill:" + P.rose + "}}";

function stars(w: number, h: number, n: number, seed: number) {
  let s = seed, out = "";
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const x = Math.round(rnd() * (w - 4)), y = 30 + Math.round(rnd() * (h - 34)), z = rnd() < 0.3 ? 3 : 2;
    out += '<rect x="' + x + '" y="' + y + '" width="' + z + '" height="' + z + '" fill="' + [P.muted, P.subtle, P.hl][i % 3] + '" style="animation:tw ' + (2 + rnd() * 3).toFixed(1) + "s " + (rnd() * 3).toFixed(1) + 's infinite"/>';
  }
  return out;
}

function frame(w: number, h: number, title: string, inner: string, css = "") {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" role="img"><title>' + esc(title) + "</title><style>" + BASE_CSS + css + "</style>" +
    '<rect width="' + w + '" height="' + h + '" rx="10" fill="' + P.base + '"/><rect x=".5" y=".5" width="' + (w - 1) + '" height="' + (h - 1) + '" rx="10" fill="none" stroke="' + P.hl + '"/>' + inner + "</svg>\n";
}
function titleBar(w: number, label: string) {
  return '<path d="M1 10a9 9 0 0 1 9-9h' + (w - 20) + 'a9 9 0 0 1 9 9v18H1z" fill="' + P.surface + '"/>' +
    '<circle cx="18" cy="14" r="4" fill="' + P.love + '"/><circle cx="32" cy="14" r="4" fill="' + P.gold + '"/><circle cx="46" cy="14" r="4" fill="' + P.pine + '"/>' +
    '<text x="' + w / 2 + '" y="18" text-anchor="middle" font-family="' + MONO + '" font-size="11" fill="' + P.subtle + '">' + esc(label) + "</text>";
}

// ---------- banner ----------
function banner(mobile: boolean) {
  const w = mobile ? 420 : 840, h = mobile ? 210 : 170, px = mobile ? 5 : 7;
  const name = cfg.name, tw = textWidth(name, px);
  const nx = mobile ? Math.round((w - tw) / 2) - px * 2 : 36, ny = mobile ? 56 : 52;
  let s = titleBar(w, "~/" + cfg.login) + stars(w, h, mobile ? 30 : 60, 7);
  s += pixelText(name, nx + px / 2, ny + px / 2, px, { fill: P.overlay });
  s += pixelText(name, nx, ny, px, { anim: (i) => "fill:" + P.iris + ";animation:pop .5s " + (i * 0.07).toFixed(2) + "s backwards,hue 6s " + (i * 0.15).toFixed(2) + "s infinite" });
  s += '<rect x="' + (nx + tw + px * 2) + '" y="' + ny + '" width="' + px * 3 + '" height="' + px * 7 + '" fill="' + P.foam + '" style="animation:blink 1.1s steps(1) infinite"/>';
  const ty = ny + px * 7 + 30, tx = mobile ? w / 2 : nx, anchor = mobile ? "middle" : "start";
  s += '<text x="' + tx + '" y="' + ty + '" text-anchor="' + anchor + '" font-family="' + MONO + '" font-size="' + (mobile ? 14 : 15) + '" fill="' + P.text + '" style="animation:fade .8s 1s backwards">' + esc(cfg.tagline) + "</text>";
  s += '<text x="' + tx + '" y="' + (ty + 22) + '" text-anchor="' + anchor + '" font-family="' + MONO + '" font-size="' + (mobile ? 12 : 13) + '" fill="' + P.subtle + '" style="animation:fade .8s 1.3s backwards">' + esc(cfg.subline) + "</text>";
  const hx = mobile ? w / 2 - 14 : w - 92, hy = mobile ? h - 34 : 64;
  s += '<g style="transform-origin:' + (hx + 14) + "px " + (hy + 12) + 'px;animation:beat 1.2s infinite">' + sprite(HEART, hx, hy, 4, { L: P.love }) + "</g>";
  if (!mobile) s += '<g style="animation:fly 9s linear infinite">' + sprite(ROCKET, -30, 34, 3, { W: P.text, B: P.foam, F: P.gold, N: P.love }) + "</g>";
  return frame(w, h, cfg.name + " — " + cfg.tagline, s, "@keyframes fly{from{transform:translateX(0)}to{transform:translateX(" + (w + 40) + "px)}}");
}

// ---------- activity (stats + pixel heatmap) ----------
const LEVEL = [P.overlay, "#24485a", P.pine, "#5fa3b5", P.foam];
function activity(mobile: boolean) {
  const w = mobile ? 420 : 840;
  const weeks = mobile ? 24 : 53, cell = mobile ? 13 : 12, gap = 3, step = cell + gap;
  const lastDow = new Date(days[days.length - 1].date + "T00:00:00Z").getUTCDay();
  const shown = days.slice(-((weeks - 1) * 7 + lastDow + 1));
  const cols = mobile ? 3 : 5, sw = (w - 48) / cols, sh = 62, sy = 44;
  const statRows = Math.ceil(stats.length / cols);
  let s = titleBar(w, "github activity");
  stats.forEach((st, i) => {
    const x = 24 + (i % cols) * sw, y = sy + Math.floor(i / cols) * (sh + 10);
    s += '<g style="animation:fade .6s ' + (0.1 * i).toFixed(1) + 's backwards"><rect x="' + (x + 3) + '" y="' + y + '" width="' + (sw - 6) + '" height="' + sh + '" rx="6" fill="' + P.surface + '"/>' +
      '<rect x="' + (x + 3) + '" y="' + (y + 10) + '" width="3" height="' + (sh - 20) + '" fill="' + st.color + '"/>' +
      pixelText(st.value, x + 18, y + 10, 3, { fill: st.color }) +
      '<text x="' + (x + 18) + '" y="' + (y + 46) + '" font-family="' + MONO + '" font-size="11" font-weight="bold" fill="' + P.text + '">' + st.label + "</text>" +
      '<text x="' + (x + 18) + '" y="' + (y + 57) + '" font-family="' + MONO + '" font-size="9" fill="' + P.muted + '">' + esc(st.sub) + "</text></g>";
  });
  const gy = sy + statRows * (sh + 10) + 26, gx = Math.round((w - (weeks * step - gap)) / 2);
  const start = new Date(shown[0].date + "T00:00:00Z").getUTCDay();
  let lastMonth = -1, cells = "";
  shown.forEach((d, i) => {
    const k = i + start, c = Math.floor(k / 7), r = k % 7, dt = new Date(d.date + "T00:00:00Z");
    if (r === 0 || i === 0) {
      const m = dt.getUTCMonth();
      if (m !== lastMonth && dt.getUTCDate() <= 7 && c < weeks - 1) { s += '<text x="' + (gx + c * step) + '" y="' + (gy - 8) + '" font-family="' + MONO + '" font-size="10" fill="' + P.muted + '">' + "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m] + "</text>"; lastMonth = m; }
    }
    cells += '<rect x="' + (gx + c * step) + '" y="' + (gy + r * step) + '" width="' + cell + '" height="' + cell + '" rx="2" fill="' + LEVEL[d.level] + '" style="animation:pop .35s ' + (c * 0.025).toFixed(3) + 's backwards"><title>' + d.count + " on " + d.date + "</title></rect>";
  });
  s += cells;
  const gh = 7 * step - gap;
  s += '<rect x="' + (gx - 3) + '" y="' + (gy - 3) + '" width="' + (cell + 6) + '" height="' + (gh + 6) + '" rx="3" fill="' + P.foam + '" fill-opacity=".18" stroke="' + P.foam + '" stroke-opacity=".5" style="opacity:0;animation:scan 8s 1.6s linear infinite"/>';
  const ly = gy + gh + 22;
  s += '<text x="' + gx + '" y="' + (ly + 9) + '" font-family="' + MONO + '" font-size="10" fill="' + P.muted + '">less</text>';
  LEVEL.forEach((c, i) => (s += '<rect x="' + (gx + 32 + i * 14) + '" y="' + ly + '" width="11" height="11" rx="2" fill="' + c + '"/>'));
  s += '<text x="' + (gx + 32 + 5 * 14 + 4) + '" y="' + (ly + 9) + '" font-family="' + MONO + '" font-size="10" fill="' + P.muted + '">more</text>';
  const lx = mobile ? gx : gx + 200, lyy = mobile ? ly + 26 : ly;
  const barW = mobile ? w - 2 * gx : w - gx - lx;
  let acc = 0, tx = lx;
  langs.forEach(([name, v], i) => {
    const bw = (v.n / langTotal) * barW;
    s += '<rect x="' + (lx + acc).toFixed(1) + '" y="' + (lyy + 2) + '" width="' + Math.max(bw - 2, 1).toFixed(1) + '" height="7" fill="' + (v.color || P.subtle) + '" style="animation:fade .5s ' + (1 + i * 0.15).toFixed(2) + 's backwards"/>';
    acc += bw;
    s += '<rect x="' + tx + '" y="' + (lyy + 16) + '" width="7" height="7" fill="' + (v.color || P.subtle) + '"/><text x="' + (tx + 11) + '" y="' + (lyy + 23) + '" font-family="' + MONO + '" font-size="10" fill="' + P.subtle + '">' + esc(name) + "</text>";
    tx += 11 + name.length * 6.2 + 14;
  });
  const h = lyy + 40;
  return frame(w, h, "GitHub activity for @" + cfg.login, s, "@keyframes scan{0%{opacity:1;transform:translateX(0)}96%{opacity:1;transform:translateX(" + (weeks * step) + "px)}100%{opacity:0;transform:translateX(" + (weeks * step) + "px)}}");
}

// ---------- connect buttons ----------
const ICONS: Record<string, string[]> = {
  x: ["W.....W", ".W...W.", "..W.W..", "...W...", "..W.W..", ".W...W.", "W.....W"],
  linkedin: ["W.WW.W.", ".......", "W.WWWW.", "W.W..W.", "W.W..W.", "W.W..W.", "W.W..W."],
  threads: [".WWWWW.", "W.....W", "W.WWW.W", "W.W.W.W", "W.WWWWW", "W......", ".WWWWW."],
};
const ICON_BG: Record<string, string> = { x: P.text, linkedin: P.foam, threads: P.iris };
function button(c: { id: string; label: string }) {
  const w = Math.ceil(54 + c.label.length * 8), h = 36;
  const s = '<rect x="3" y="3" width="' + (w - 3) + '" height="' + (h - 3) + '" fill="' + P.hl + '"/><rect x=".5" y=".5" width="' + (w - 4) + '" height="' + (h - 4) + '" fill="' + P.base + '" stroke="' + P.hl + '"/>' +
    '<rect x="6" y="5" width="23" height="23" fill="' + ICON_BG[c.id] + '"/>' + sprite(ICONS[c.id], 7, 6, 3, { W: P.base }) +
    '<text x="38" y="21.5" font-family="' + MONO + '" font-size="13" fill="' + P.text + '">' + esc(c.label) + "</text>";
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" role="img"><title>' + c.id + " " + esc(c.label) + "</title>" + s + "</svg>\n";
}

// ---------- write ----------
mkdirSync("assets", { recursive: true });
writeFileSync("assets/banner.svg", banner(false));
writeFileSync("assets/banner-mobile.svg", banner(true));
writeFileSync("assets/activity.svg", activity(false));
writeFileSync("assets/activity-mobile.svg", activity(true));
for (const c of cfg.connect) writeFileSync("assets/connect-" + c.id + ".svg", button(c));

const latest = repos
  .filter((r) => !r.isArchived && !cfg.exclude.includes(r.name) && (cfg.descriptions[r.name] || r.description))
  .slice(0, cfg.latestCount);
const row = (r: any) => {
  const desc = cfg.descriptions[r.name] ?? r.description ?? "";
  const meta = [r.primaryLanguage?.name, r.stargazerCount ? "★ " + fmt(r.stargazerCount) : ""].filter(Boolean).join(" · ");
  return "- **[" + r.name + "](" + r.url + ")** — " + desc + (meta ? " <sub>" + meta + "</sub>" : "");
};
const table = [...featured.map(row), ...latest.map(row)].join("\n");
const readme = readFileSync("README.md", "utf8");
writeFileSync("README.md", readme.replace(/<!-- projects:start -->[\s\S]*<!-- projects:end -->/, "<!-- projects:start -->\n" + table + "\n<!-- projects:end -->"));
console.log("latest:", latest.map((r) => r.name).join(", "));
