/**
 * Quantum AI – Hackathon presentation generator.
 * Produces Quantum_AI_Hackathon.pptx in the same folder.
 */

const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();

pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
pptx.title = "Quantum AI – From Requirement to Run";
pptx.author = "Quantum AI Team";
pptx.company = "Cursor Hackathon";
pptx.subject = "AI-powered Test Engineering Platform";

const COLORS = {
  indigo: "4F46E5",
  indigoDark: "3730A3",
  slate900: "0F172A",
  slate700: "334155",
  slate500: "64748B",
  slate200: "E2E8F0",
  slate50: "F8FAFC",
  white: "FFFFFF",
  green: "22C55E",
  amber: "F59E0B",
  red: "EF4444",
  blue: "3B82F6",
};

// ---------- Master Slide ----------
pptx.defineSlideMaster({
  title: "QUANTUM_MASTER",
  background: { color: COLORS.slate50 },
  objects: [
    // Top accent bar
    { rect: { x: 0, y: 0, w: 13.33, h: 0.35, fill: { color: COLORS.indigo } } },
    // Footer text
    {
      text: {
        text: "Quantum AI  ·  From Requirement to Run",
        options: {
          x: 0.4,
          y: 7.1,
          w: 8,
          h: 0.3,
          fontSize: 10,
          fontFace: "Calibri",
          color: COLORS.slate500,
        },
      },
    },
    // Slide number
    {
      text: {
        text: "Cursor Hackathon",
        options: {
          x: 11.0,
          y: 7.1,
          w: 2.0,
          h: 0.3,
          fontSize: 10,
          fontFace: "Calibri",
          color: COLORS.slate500,
          align: "right",
        },
      },
    },
  ],
  slideNumber: { x: 12.7, y: 7.1, w: 0.5, h: 0.3, fontSize: 10, color: COLORS.slate500, align: "right" },
});

const TITLE_OPTS = {
  x: 0.5,
  y: 0.55,
  w: 12.3,
  h: 0.7,
  fontSize: 30,
  bold: true,
  color: COLORS.slate900,
  fontFace: "Calibri",
};

const SUBTITLE_OPTS = {
  x: 0.5,
  y: 1.2,
  w: 12.3,
  h: 0.4,
  fontSize: 14,
  color: COLORS.indigo,
  fontFace: "Calibri",
  italic: true,
};

function addSectionTitle(slide, title, subtitle) {
  slide.addText(title, TITLE_OPTS);
  if (subtitle) slide.addText(subtitle, SUBTITLE_OPTS);
  // Underline accent
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.65,
    w: 1.0,
    h: 0.06,
    fill: { color: COLORS.indigo },
    line: { color: COLORS.indigo },
  });
}

// ============================================================
// SLIDE 1 — Title
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  // Hero block
  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.35,
    w: 13.33,
    h: 6.75,
    fill: { color: COLORS.indigo },
    line: { color: COLORS.indigo },
  });

  // "Q" glyph circle
  s.addShape(pptx.ShapeType.ellipse, {
    x: 0.8,
    y: 1.0,
    w: 1.4,
    h: 1.4,
    fill: { color: COLORS.white },
    line: { color: COLORS.white },
  });
  s.addText("Q", {
    x: 0.8,
    y: 1.0,
    w: 1.4,
    h: 1.4,
    fontSize: 60,
    bold: true,
    color: COLORS.indigo,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  });

  s.addText("Quantum AI", {
    x: 2.5,
    y: 1.05,
    w: 10,
    h: 1.2,
    fontSize: 60,
    bold: true,
    color: COLORS.white,
    fontFace: "Calibri",
  });

  s.addText("From Requirement to Run.", {
    x: 2.5,
    y: 2.15,
    w: 10,
    h: 0.6,
    fontSize: 24,
    italic: true,
    color: "C7D2FE",
    fontFace: "Calibri",
  });

  s.addShape(pptx.ShapeType.rect, {
    x: 0.8,
    y: 3.2,
    w: 11.7,
    h: 0.04,
    fill: { color: "C7D2FE" },
    line: { color: "C7D2FE" },
  });

  s.addText(
    "Cloud-based AI Test Engineering Platform — ingests requirements, generates ISTQB-grade test cases, crawls the AUT, generates Playwright scripts, pushes to Git, and executes on BrowserStack.",
    {
      x: 0.8,
      y: 3.4,
      w: 11.7,
      h: 1.5,
      fontSize: 18,
      color: COLORS.white,
      fontFace: "Calibri",
      paraSpaceAfter: 6,
    }
  );

  // Tag chips
  const chips = ["NestJS", "Angular + NG-ZORRO", "MongoDB", "OpenAI", "Playwright", "BrowserStack"];
  let cx = 0.8;
  chips.forEach((c) => {
    const w = 0.25 + c.length * 0.13;
    s.addShape(pptx.ShapeType.roundRect, {
      x: cx,
      y: 5.5,
      w,
      h: 0.45,
      fill: { color: COLORS.indigoDark },
      line: { color: "C7D2FE" },
      rectRadius: 0.1,
    });
    s.addText(c, {
      x: cx,
      y: 5.5,
      w,
      h: 0.45,
      fontSize: 12,
      color: COLORS.white,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
      bold: true,
    });
    cx += w + 0.2;
  });

  s.addText("Cursor Hackathon  ·  v2.1  ·  ~5 Hour Build", {
    x: 0.8,
    y: 6.45,
    w: 12,
    h: 0.4,
    fontSize: 14,
    color: "C7D2FE",
    fontFace: "Calibri",
  });
}

// ============================================================
// SLIDE 2 — Problem
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "The Problem", "QA teams are buried in repetitive test design and brittle automation");

  const problems = [
    { t: "Slow Test Design", d: "Manual writing of ISTQB-grade test cases for every requirement burns analyst hours." },
    { t: "Disconnected Tools", d: "Jira, Confluence, test management, and automation frameworks live in silos." },
    { t: "Brittle Automation", d: "Hand-coded Playwright/Selenium scripts break the moment selectors shift." },
    { t: "Weak Traceability", d: "No clean line of sight from requirement → test case → execution → coverage." },
    { t: "Slow Feedback", d: "Authoring → review → automation → execution can take days, not minutes." },
    { t: "Inconsistent Quality", d: "Coverage of positive, negative, and boundary cases varies by author." },
  ];

  let row = 0,
    col = 0;
  problems.forEach((p, i) => {
    col = i % 3;
    row = Math.floor(i / 3);
    const x = 0.5 + col * 4.2;
    const y = 2.0 + row * 2.3;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 4.0,
      h: 2.0,
      fill: { color: COLORS.white },
      line: { color: COLORS.slate200, width: 1 },
      rectRadius: 0.1,
    });
    s.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.12,
      h: 2.0,
      fill: { color: COLORS.red },
      line: { color: COLORS.red },
    });
    s.addText(p.t, {
      x: x + 0.3,
      y: y + 0.15,
      w: 3.6,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: COLORS.slate900,
      fontFace: "Calibri",
    });
    s.addText(p.d, {
      x: x + 0.3,
      y: y + 0.7,
      w: 3.6,
      h: 1.2,
      fontSize: 12,
      color: COLORS.slate700,
      fontFace: "Calibri",
    });
  });
}

// ============================================================
// SLIDE 3 — Solution
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Our Solution", "One platform, one flow: Requirement → Test Cases → Script → Run");

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 2.0,
    w: 12.3,
    h: 1.2,
    fill: { color: COLORS.indigo },
    line: { color: COLORS.indigo },
    rectRadius: 0.1,
  });
  s.addText(
    "Quantum AI ingests requirements (Jira / Confluence / free text), uses an LLM to generate ISTQB-grade test cases, crawls the AUT to extract a Page Object Model, maps test steps to real UI elements, generates Playwright scripts, pushes to Git, and executes on BrowserStack — all from a single web UI.",
    {
      x: 0.8,
      y: 2.1,
      w: 11.7,
      h: 1.0,
      fontSize: 14,
      color: COLORS.white,
      fontFace: "Calibri",
      italic: true,
    }
  );

  // Pipeline boxes
  const stages = [
    { t: "Ingest", d: "Jira / Confluence / Text", c: COLORS.blue },
    { t: "Generate", d: "ISTQB AI Test Cases", c: COLORS.indigo },
    { t: "Review", d: "Approve / Reject / Edit", c: COLORS.amber },
    { t: "Crawl", d: "Page Object Model", c: COLORS.indigoDark },
    { t: "Map & Script", d: "Playwright + Git Push", c: COLORS.slate700 },
    { t: "Execute", d: "BrowserStack Run", c: COLORS.green },
  ];

  const stageW = 1.85;
  const gap = 0.18;
  let xs = 0.5;
  stages.forEach((st, i) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x: xs,
      y: 4.0,
      w: stageW,
      h: 1.6,
      fill: { color: st.c },
      line: { color: st.c },
      rectRadius: 0.1,
    });
    s.addText(`${i + 1}. ${st.t}`, {
      x: xs,
      y: 4.1,
      w: stageW,
      h: 0.5,
      fontSize: 14,
      bold: true,
      color: COLORS.white,
      align: "center",
      fontFace: "Calibri",
    });
    s.addText(st.d, {
      x: xs,
      y: 4.65,
      w: stageW,
      h: 0.9,
      fontSize: 11,
      color: COLORS.white,
      align: "center",
      fontFace: "Calibri",
    });
    if (i < stages.length - 1) {
      s.addShape(pptx.ShapeType.rightArrow, {
        x: xs + stageW + 0.005,
        y: 4.72,
        w: 0.17,
        h: 0.16,
        fill: { color: COLORS.slate500 },
        line: { color: COLORS.slate500 },
      });
    }
    xs += stageW + gap;
  });

  s.addText("Outcome: From a single requirement to a green BrowserStack run in minutes — with full traceability.", {
    x: 0.5,
    y: 6.1,
    w: 12.3,
    h: 0.5,
    fontSize: 14,
    color: COLORS.slate700,
    align: "center",
    italic: true,
    fontFace: "Calibri",
  });
}

// ============================================================
// SLIDE 4 — MVP Scope
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "MVP Scope", "What ships in the 5-hour build window");

  const inScope = [
    "Login → Feature → Test Suite → Test Case hierarchy",
    "Requirement intake (Jira ID, Confluence link, raw text)",
    "AI test case generation (LLM-backed, mockable)",
    "Review / edit / approve / reject → save to DB",
    "Page crawl + element store",
    "Step ↔ element mapping → Playwright script generation",
    "Push generated script to Git",
    "Trigger run on BrowserStack with live status",
    "Dashboard with coverage + traceability metrics",
  ];

  const outScope = [
    "Multi-tenant orgs, RBAC, SSO",
    "Real-time collaboration",
    "Self-hosted LLM / fine-tuning",
    "Mobile / API / performance test types",
    "Production observability",
    "UX polish, animations, dark mode, charts (deferred)",
  ];

  // In Scope card
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 1.95,
    w: 6.1,
    h: 4.9,
    fill: { color: COLORS.white },
    line: { color: COLORS.slate200 },
    rectRadius: 0.1,
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.95,
    w: 6.1,
    h: 0.5,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
  s.addText("In Scope", {
    x: 0.7,
    y: 1.95,
    w: 5.9,
    h: 0.5,
    fontSize: 18,
    bold: true,
    color: COLORS.white,
    valign: "middle",
    fontFace: "Calibri",
  });
  s.addText(
    inScope.map((t) => ({ text: t, options: { bullet: { code: "25CF" }, color: COLORS.slate700, fontSize: 13 } })),
    {
      x: 0.7,
      y: 2.55,
      w: 5.7,
      h: 4.2,
      fontFace: "Calibri",
      paraSpaceAfter: 6,
    }
  );

  // Out of Scope card
  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.75,
    y: 1.95,
    w: 6.1,
    h: 4.9,
    fill: { color: COLORS.white },
    line: { color: COLORS.slate200 },
    rectRadius: 0.1,
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 6.75,
    y: 1.95,
    w: 6.1,
    h: 0.5,
    fill: { color: COLORS.red },
    line: { color: COLORS.red },
  });
  s.addText("Out of Scope", {
    x: 6.95,
    y: 1.95,
    w: 5.9,
    h: 0.5,
    fontSize: 18,
    bold: true,
    color: COLORS.white,
    valign: "middle",
    fontFace: "Calibri",
  });
  s.addText(
    outScope.map((t) => ({ text: t, options: { bullet: { code: "25CB" }, color: COLORS.slate700, fontSize: 13 } })),
    {
      x: 6.95,
      y: 2.55,
      w: 5.7,
      h: 4.2,
      fontFace: "Calibri",
      paraSpaceAfter: 6,
    }
  );
}

// ============================================================
// SLIDE 5 — Architecture
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Architecture", "Frontend → Gateway → AI / Crawler / Executor → Mongo");

  // Frontend
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 2.2,
    w: 2.6,
    h: 1.2,
    fill: { color: COLORS.indigo },
    line: { color: COLORS.indigo },
    rectRadius: 0.1,
  });
  s.addText("Angular Web\n(NG-ZORRO, :4200)", {
    x: 0.5,
    y: 2.2,
    w: 2.6,
    h: 1.2,
    fontSize: 13,
    bold: true,
    color: COLORS.white,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  });

  // Arrow
  s.addShape(pptx.ShapeType.line, {
    x: 3.1,
    y: 2.8,
    w: 1.0,
    h: 0,
    line: { color: COLORS.slate700, width: 2, endArrowType: "triangle" },
  });

  // Gateway / NestJS
  s.addShape(pptx.ShapeType.roundRect, {
    x: 4.1,
    y: 2.2,
    w: 2.8,
    h: 1.2,
    fill: { color: COLORS.indigoDark },
    line: { color: COLORS.indigoDark },
    rectRadius: 0.1,
  });
  s.addText("NestJS Gateway / API\n(REST, JWT, Swagger, :3000)", {
    x: 4.1,
    y: 2.2,
    w: 2.8,
    h: 1.2,
    fontSize: 13,
    bold: true,
    color: COLORS.white,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  });

  // 3 services
  const svcs = [
    { t: "AI Engine", d: "OpenAI · ISTQB Prompts", c: COLORS.blue },
    { t: "Crawler", d: "Playwright · POM Extractor", c: COLORS.amber },
    { t: "Executor", d: "Playwright · BrowserStack", c: COLORS.green },
  ];
  svcs.forEach((sv, i) => {
    const y = 1.5 + i * 1.6;
    s.addShape(pptx.ShapeType.line, {
      x: 6.9,
      y: 2.8,
      w: 1.0,
      h: y - 2.8 + 0.5,
      line: { color: COLORS.slate700, width: 2 },
    });
    s.addShape(pptx.ShapeType.line, {
      x: 7.9,
      y: y + 0.5,
      w: 0.5,
      h: 0,
      line: { color: COLORS.slate700, width: 2, endArrowType: "triangle" },
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: 8.4,
      y,
      w: 3.4,
      h: 1.0,
      fill: { color: sv.c },
      line: { color: sv.c },
      rectRadius: 0.1,
    });
    s.addText(`${sv.t}\n${sv.d}`, {
      x: 8.4,
      y,
      w: 3.4,
      h: 1.0,
      fontSize: 12,
      bold: true,
      color: COLORS.white,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    });
  });

  // Mongo
  s.addShape(pptx.ShapeType.roundRect, {
    x: 4.1,
    y: 4.0,
    w: 2.8,
    h: 1.0,
    fill: { color: COLORS.slate900 },
    line: { color: COLORS.slate900 },
    rectRadius: 0.1,
  });
  s.addText("MongoDB\n(local + Atlas M0)", {
    x: 4.1,
    y: 4.0,
    w: 2.8,
    h: 1.0,
    fontSize: 13,
    bold: true,
    color: COLORS.white,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  });
  s.addShape(pptx.ShapeType.line, {
    x: 5.5,
    y: 3.4,
    w: 0,
    h: 0.6,
    line: { color: COLORS.slate700, width: 2, endArrowType: "triangle" },
  });

  // External
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 5.6,
    w: 12.3,
    h: 1.2,
    fill: { color: COLORS.slate50 },
    line: { color: COLORS.slate200, width: 1 },
    rectRadius: 0.1,
  });
  s.addText("External Integrations", {
    x: 0.7,
    y: 5.65,
    w: 12,
    h: 0.4,
    fontSize: 13,
    bold: true,
    color: COLORS.slate900,
    fontFace: "Calibri",
  });
  s.addText("Jira REST   ·   Confluence REST   ·   OpenAI   ·   GitHub REST   ·   BrowserStack Automate", {
    x: 0.7,
    y: 6.05,
    w: 12,
    h: 0.7,
    fontSize: 14,
    color: COLORS.slate700,
    fontFace: "Calibri",
  });
}

// ============================================================
// SLIDE 6 — Tech Stack
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Tech Stack", "Modern, opinionated, hackathon-friendly");

  const stack = [
    { layer: "Frontend", items: "Angular 21, NG-ZORRO, RxJS, Reactive Forms, Tailwind defaults" },
    { layer: "Backend / API", items: "NestJS (TypeScript), REST, JWT (access + refresh), Swagger" },
    { layer: "Database", items: "MongoDB + Mongoose (local for dev, MongoDB Atlas M0 for demo)" },
    { layer: "AI / LLM", items: "OpenAI (ISTQB-aligned prompts: equivalence, BVA, decision tables, error guessing)" },
    { layer: "Test Automation", items: "Playwright (crawler + executor) on BrowserStack Automate" },
    { layer: "Integrations", items: "Jira REST, Confluence REST, GitHub REST (push generated scripts)" },
    { layer: "DevOps", items: "Docker Compose (Mongo), Render (web + gateway + ai-engine), conventional commits" },
    { layer: "Tooling", items: "Cursor IDE for AI-assisted dev, Heroicons, Inter font, indigo brand palette" },
  ];

  // Table-like layout
  const startY = 2.0;
  const rowH = 0.55;
  stack.forEach((row, i) => {
    const y = startY + i * rowH;
    const bg = i % 2 === 0 ? COLORS.white : COLORS.slate50;
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y,
      w: 12.3,
      h: rowH,
      fill: { color: bg },
      line: { color: COLORS.slate200, width: 0.5 },
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y,
      w: 0.08,
      h: rowH,
      fill: { color: COLORS.indigo },
      line: { color: COLORS.indigo },
    });
    s.addText(row.layer, {
      x: 0.75,
      y,
      w: 3.0,
      h: rowH,
      fontSize: 14,
      bold: true,
      color: COLORS.indigoDark,
      valign: "middle",
      fontFace: "Calibri",
    });
    s.addText(row.items, {
      x: 3.85,
      y,
      w: 8.85,
      h: rowH,
      fontSize: 13,
      color: COLORS.slate700,
      valign: "middle",
      fontFace: "Calibri",
    });
  });
}

// ============================================================
// SLIDE 7 — Application Pages
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Application Pages", "12 focused screens covering the entire flow");

  const pages = [
    ["1. Login", "/login"],
    ["2. Dashboard", "/"],
    ["3. Feature Detail", "/features/:id"],
    ["4. Suite Detail", "/suites/:id"],
    ["5. Settings · Integrations", "/settings"],
    ["6. Requirement Intake", "/generate"],
    ["7. Review Generated TCs", "/review/:batch"],
    ["8. Traceability", "/traceability"],
    ["9. Page Crawl", "/crawler"],
    ["10. Mapping & Script Gen", "/mapping/:suite"],
    ["11. Execution", "/runs"],
    ["12. Metrics", "/metrics"],
  ];

  pages.forEach((p, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.5 + col * 3.15;
    const y = 2.0 + row * 1.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 3.0,
      h: 1.2,
      fill: { color: COLORS.white },
      line: { color: COLORS.indigo, width: 1.5 },
      rectRadius: 0.08,
    });
    s.addText(p[0], {
      x: x + 0.15,
      y: y + 0.15,
      w: 2.7,
      h: 0.5,
      fontSize: 14,
      bold: true,
      color: COLORS.slate900,
      fontFace: "Calibri",
    });
    s.addText(p[1], {
      x: x + 0.15,
      y: y + 0.65,
      w: 2.7,
      h: 0.45,
      fontSize: 12,
      color: COLORS.indigo,
      fontFace: "Consolas",
    });
  });

  s.addText("All pages use NG-ZORRO components: nz-layout · nz-table · nz-form · nz-modal · nz-card · nz-tag · nz-message", {
    x: 0.5,
    y: 6.4,
    w: 12.3,
    h: 0.4,
    fontSize: 12,
    color: COLORS.slate500,
    italic: true,
    align: "center",
    fontFace: "Calibri",
  });
}

// ============================================================
// SLIDE 8 — AUT (SauceDemo)
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Application Under Test", "SauceDemo / Swag Labs — public e-commerce sandbox");

  // Left: AUT card
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 2.0,
    w: 5.8,
    h: 4.8,
    fill: { color: COLORS.white },
    line: { color: COLORS.slate200 },
    rectRadius: 0.1,
  });
  s.addText("SauceDemo", {
    x: 0.7,
    y: 2.1,
    w: 5.4,
    h: 0.5,
    fontSize: 20,
    bold: true,
    color: COLORS.indigo,
    fontFace: "Calibri",
  });
  s.addText("https://www.saucedemo.com/", {
    x: 0.7,
    y: 2.65,
    w: 5.4,
    h: 0.4,
    fontSize: 12,
    color: COLORS.slate500,
    fontFace: "Consolas",
  });
  s.addText(
    [
      { text: "Why this AUT:", options: { bold: true, color: COLORS.slate900, fontSize: 13 } },
      { text: "\nStable, public, no captcha / 2FA — purpose-built for automation tooling like Playwright, Selenium, and Cypress.\n\n", options: { color: COLORS.slate700, fontSize: 13 } },
      { text: "Seed Users (password: secret_sauce):", options: { bold: true, color: COLORS.slate900, fontSize: 13 } },
      { text: "\n• standard_user — happy path\n• locked_out_user — negative\n• problem_user — broken images\n• performance_glitch_user — slow login\n• error_user — form errors\n• visual_user — visual regression", options: { color: COLORS.slate700, fontSize: 12 } },
    ],
    {
      x: 0.7,
      y: 3.15,
      w: 5.4,
      h: 3.6,
      fontFace: "Calibri",
      paraSpaceAfter: 2,
    }
  );

  // Right: Golden flow
  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.55,
    y: 2.0,
    w: 6.3,
    h: 4.8,
    fill: { color: COLORS.indigo },
    line: { color: COLORS.indigo },
    rectRadius: 0.1,
  });
  s.addText("Golden Flow (demo path)", {
    x: 6.75,
    y: 2.1,
    w: 5.9,
    h: 0.5,
    fontSize: 18,
    bold: true,
    color: COLORS.white,
    fontFace: "Calibri",
  });
  const steps = [
    "Open https://www.saucedemo.com/",
    "Login as standard_user / secret_sauce",
    "Add 'Sauce Labs Backpack' to cart",
    "Open cart → Checkout",
    "Enter Quantum / AI / 560001",
    "Continue → Finish",
    "Assert 'Thank you for your order!'",
    "Logout via burger menu",
  ];
  s.addText(
    steps.map((t, i) => ({
      text: `${i + 1}.  ${t}`,
      options: { color: COLORS.white, fontSize: 13 },
    })),
    {
      x: 6.75,
      y: 2.7,
      w: 5.9,
      h: 4.0,
      paraSpaceAfter: 8,
      fontFace: "Calibri",
    }
  );
}

// ============================================================
// SLIDE 9 — AI Test Generation (ISTQB)
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "AI Test Case Generation", "ISTQB-aligned, mockable, traceable");

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 2.0,
    w: 6.0,
    h: 4.8,
    fill: { color: COLORS.white },
    line: { color: COLORS.slate200 },
    rectRadius: 0.1,
  });
  s.addText("Design Techniques (in LLM prompt)", {
    x: 0.7,
    y: 2.1,
    w: 5.6,
    h: 0.5,
    fontSize: 16,
    bold: true,
    color: COLORS.slate900,
    fontFace: "Calibri",
  });
  s.addText(
    [
      { text: "Equivalence Partitioning", options: { bold: true, color: COLORS.indigo, fontSize: 14 } },
      { text: "  →  Group inputs into valid / invalid classes\n", options: { color: COLORS.slate700, fontSize: 12 } },
      { text: "Boundary Value Analysis", options: { bold: true, color: COLORS.indigo, fontSize: 14 } },
      { text: "  →  Test the edges of each class\n", options: { color: COLORS.slate700, fontSize: 12 } },
      { text: "Decision Table Testing", options: { bold: true, color: COLORS.indigo, fontSize: 14 } },
      { text: "  →  Combinatorial rules → unique cases\n", options: { color: COLORS.slate700, fontSize: 12 } },
      { text: "Error Guessing", options: { bold: true, color: COLORS.indigo, fontSize: 14 } },
      { text: "  →  Heuristic negatives the LLM is good at", options: { color: COLORS.slate700, fontSize: 12 } },
    ],
    {
      x: 0.7,
      y: 2.7,
      w: 5.6,
      h: 2.5,
      fontFace: "Calibri",
      paraSpaceAfter: 8,
    }
  );

  s.addShape(pptx.ShapeType.line, {
    x: 0.7,
    y: 5.3,
    w: 5.6,
    h: 0,
    line: { color: COLORS.slate200, width: 1 },
  });
  s.addText("Output: positive + negative + boundary cases per requirement, each with full traceability via requirementRef.", {
    x: 0.7,
    y: 5.5,
    w: 5.6,
    h: 1.2,
    fontSize: 12,
    color: COLORS.slate700,
    italic: true,
    fontFace: "Calibri",
  });

  // Right: Sample TC JSON
  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.75,
    y: 2.0,
    w: 6.1,
    h: 4.8,
    fill: { color: COLORS.slate900 },
    line: { color: COLORS.slate900 },
    rectRadius: 0.1,
  });
  s.addText("Sample Test Case (frozen contract)", {
    x: 6.95,
    y: 2.1,
    w: 5.7,
    h: 0.4,
    fontSize: 14,
    bold: true,
    color: COLORS.white,
    fontFace: "Calibri",
  });
  s.addText(
    `{
  "id": "TC001",
  "suiteId": "S001",
  "title": "Login with valid credentials",
  "steps": [
    { "step": "Enter username", "expected": "Accepted" },
    { "step": "Enter password", "expected": "Accepted" },
    { "step": "Click login",    "expected": "Dashboard" }
  ],
  "tags": ["smoke", "login"],
  "status": "pending",
  "requirementRef": {
    "source": "jira",
    "key": "PROJ-123"
  },
  "createdBy": "ai"
}`,
    {
      x: 6.95,
      y: 2.55,
      w: 5.7,
      h: 4.1,
      fontSize: 11,
      color: "A5F3FC",
      fontFace: "Consolas",
      valign: "top",
    }
  );
}

// ============================================================
// SLIDE 10 — Demo Flow
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Demo Flow", "5–7 minute live walkthrough");

  const demo = [
    { t: "Login", d: "Quantum AI → Dashboard (SauceDemo seed user)" },
    { t: "Create", d: "Feature 'E-Commerce Checkout' → Suite 'Checkout Flow'" },
    { t: "Generate", d: "Paste user story on /generate → AI returns ISTQB test cases" },
    { t: "Review", d: "Confirm positive + negative + boundary; tweak; approve all" },
    { t: "Crawl", d: "/crawler → enter saucedemo URL → extract page elements" },
    { t: "Map & Push", d: "Auto-suggest binds steps → generate Playwright → push to Git" },
    { t: "Execute", d: "/runs → Run on BrowserStack (Chrome / Win11) → live URL" },
    { t: "Verify", d: "Metrics + Traceability: coverage 0% → 100%, # automated, # passing" },
  ];

  demo.forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 6.3;
    const y = 2.0 + row * 1.2;
    // Number circle
    s.addShape(pptx.ShapeType.ellipse, {
      x,
      y,
      w: 0.8,
      h: 0.8,
      fill: { color: COLORS.indigo },
      line: { color: COLORS.indigo },
    });
    s.addText(`${i + 1}`, {
      x,
      y,
      w: 0.8,
      h: 0.8,
      fontSize: 22,
      bold: true,
      color: COLORS.white,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    });
    s.addText(d.t, {
      x: x + 0.95,
      y,
      w: 5.2,
      h: 0.4,
      fontSize: 15,
      bold: true,
      color: COLORS.slate900,
      fontFace: "Calibri",
    });
    s.addText(d.d, {
      x: x + 0.95,
      y: y + 0.4,
      w: 5.2,
      h: 0.55,
      fontSize: 11,
      color: COLORS.slate700,
      fontFace: "Calibri",
    });
  });

  s.addText("Fallbacks ready: pre-recorded BrowserStack run · cached element JSON · pre-pushed Git commit", {
    x: 0.5,
    y: 6.7,
    w: 12.3,
    h: 0.3,
    fontSize: 11,
    italic: true,
    color: COLORS.slate500,
    align: "center",
    fontFace: "Calibri",
  });
}

// ============================================================
// SLIDE 11 — Risks & Mitigations
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Risks & Mitigations", "Mocks are the fallback path, not the primary path");

  const headers = ["Risk", "Likelihood", "Mitigation"];
  const widths = [4.5, 1.8, 5.5];
  const startX = 0.6;
  let cx = startX;
  headers.forEach((h, i) => {
    s.addShape(pptx.ShapeType.rect, {
      x: cx,
      y: 2.0,
      w: widths[i],
      h: 0.5,
      fill: { color: COLORS.indigo },
      line: { color: COLORS.indigo },
    });
    s.addText(h, {
      x: cx + 0.1,
      y: 2.0,
      w: widths[i] - 0.2,
      h: 0.5,
      fontSize: 13,
      bold: true,
      color: COLORS.white,
      valign: "middle",
      fontFace: "Calibri",
    });
    cx += widths[i];
  });

  const rows = [
    ["OpenAI rate-limit / no key", "M", "Mock generator with 3 canned TC templates"],
    ["Jira/Confluence creds unavailable", "H", "Free-text input is the primary demo path"],
    ["BrowserStack quota exhausted", "M", "Pre-record demo run; local Playwright fallback"],
    ["Crawler blocked by auth", "L", "AUT is public SauceDemo"],
    ["SauceDemo down during demo", "L", "Pre-cached element JSON fixture"],
    ["Merge conflicts in gateway", "M", "Single owner (AI); contracts package shared"],
    ["Time overrun on UI polish", "H", "Tailwind defaults only; no custom CSS until H4"],
  ];

  const rowH = 0.5;
  rows.forEach((r, i) => {
    cx = startX;
    const y = 2.5 + i * rowH;
    const bg = i % 2 === 0 ? COLORS.white : COLORS.slate50;
    r.forEach((cell, j) => {
      s.addShape(pptx.ShapeType.rect, {
        x: cx,
        y,
        w: widths[j],
        h: rowH,
        fill: { color: bg },
        line: { color: COLORS.slate200, width: 0.5 },
      });
      let txtColor = COLORS.slate700;
      if (j === 1) {
        txtColor = cell === "H" ? COLORS.red : cell === "M" ? COLORS.amber : COLORS.green;
      }
      s.addText(cell, {
        x: cx + 0.1,
        y,
        w: widths[j] - 0.2,
        h: rowH,
        fontSize: 12,
        bold: j === 1,
        color: txtColor,
        valign: "middle",
        align: j === 1 ? "center" : "left",
        fontFace: "Calibri",
      });
      cx += widths[j];
    });
  });

  s.addText("Every service exposes ?mock=true / MOCK_MODE=true so the demo survives a single failed dependency.", {
    x: 0.6,
    y: 6.4,
    w: 12.1,
    h: 0.4,
    fontSize: 12,
    italic: true,
    color: COLORS.slate500,
    align: "center",
    fontFace: "Calibri",
  });
}

// ============================================================
// SLIDE 12 — Impact / Metrics / Thank You
// ============================================================
{
  const s = pptx.addSlide({ masterName: "QUANTUM_MASTER" });
  addSectionTitle(s, "Impact & What's Next", "Built in 5 hours, ready for QA teams to extend");

  const kpis = [
    { v: "12", l: "Application Pages", c: COLORS.indigo },
    { v: "11", l: "Backend Modules", c: COLORS.indigoDark },
    { v: "100%", l: "Traceability Coverage", c: COLORS.green },
    { v: "<5 min", l: "Requirement → BrowserStack Run", c: COLORS.amber },
  ];

  kpis.forEach((k, i) => {
    const x = 0.5 + i * 3.15;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 2.0,
      w: 3.0,
      h: 1.8,
      fill: { color: k.c },
      line: { color: k.c },
      rectRadius: 0.1,
    });
    s.addText(k.v, {
      x,
      y: 2.05,
      w: 3.0,
      h: 1.0,
      fontSize: 36,
      bold: true,
      color: COLORS.white,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    });
    s.addText(k.l, {
      x,
      y: 3.05,
      w: 3.0,
      h: 0.7,
      fontSize: 13,
      color: COLORS.white,
      align: "center",
      fontFace: "Calibri",
    });
  });

  // What's next
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 4.1,
    w: 6.1,
    h: 2.5,
    fill: { color: COLORS.white },
    line: { color: COLORS.slate200 },
    rectRadius: 0.1,
  });
  s.addText("What's Next", {
    x: 0.7,
    y: 4.2,
    w: 5.7,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: COLORS.indigo,
    fontFace: "Calibri",
  });
  s.addText(
    [
      "Multi-tenant orgs + RBAC + SSO",
      "Self-healing selectors (LLM-assisted)",
      "API + performance test types",
      "Real-time collaboration on review screen",
      "Native CI integrations (GitHub Actions, GitLab)",
    ].map((t) => ({ text: t, options: { bullet: { code: "25CF" }, color: COLORS.slate700, fontSize: 12 } })),
    {
      x: 0.7,
      y: 4.65,
      w: 5.7,
      h: 1.85,
      paraSpaceAfter: 4,
      fontFace: "Calibri",
    }
  );

  // Thank you
  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.75,
    y: 4.1,
    w: 6.1,
    h: 2.5,
    fill: { color: COLORS.indigo },
    line: { color: COLORS.indigo },
    rectRadius: 0.1,
  });
  s.addText("Thank You", {
    x: 6.95,
    y: 4.3,
    w: 5.7,
    h: 0.7,
    fontSize: 32,
    bold: true,
    color: COLORS.white,
    fontFace: "Calibri",
  });
  s.addText("Quantum AI — From Requirement to Run.", {
    x: 6.95,
    y: 5.0,
    w: 5.7,
    h: 0.4,
    fontSize: 14,
    italic: true,
    color: "C7D2FE",
    fontFace: "Calibri",
  });
  s.addText("Questions?", {
    x: 6.95,
    y: 5.6,
    w: 5.7,
    h: 0.5,
    fontSize: 18,
    bold: true,
    color: COLORS.white,
    fontFace: "Calibri",
  });
  s.addText("github.com/AruljothySundaramoorthy/hackathon", {
    x: 6.95,
    y: 6.1,
    w: 5.7,
    h: 0.4,
    fontSize: 11,
    color: "C7D2FE",
    fontFace: "Consolas",
  });
}

// ---------- Save ----------
pptx
  .writeFile({ fileName: "Quantum_AI_Hackathon.pptx" })
  .then((file) => {
    console.log(`Generated: ${file}`);
  })
  .catch((err) => {
    console.error("Failed to generate PPTX:", err);
    process.exit(1);
  });
