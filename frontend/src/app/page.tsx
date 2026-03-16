"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Github,
  ArrowRight,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { SPRING_DEFAULT, SPRING_SNAPPY, SPRING_STANDARD } from "@/lib/spring";

// ─── Scroll-triggered fade-up ────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...SPRING_DEFAULT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Video placeholder ───────────────────────────────────────────────────────
function VideoPlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#080808] ${className ?? ""}`}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      {/* Play button + label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
        <div className="w-11 h-11 rounded-full border border-white/12 bg-white/5 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white/35 ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-[11px] font-mono text-white/22">{label}</span>
      </div>
    </div>
  );
}

// ─── Code tab switcher ───────────────────────────────────────────────────────
type Framework = "nestjs" | "fastapi";

const CODE: Record<Framework, { label: string; lines: string[] }> = {
  nestjs: {
    label: "NestJS",
    lines: [
      "// app.module.ts",
      "import { CodeMapModule } from '@code-map/nestjs';",
      "",
      "@Module({",
      "  imports: [",
      "    CodeMapModule.forRoot({ port: 7070 }),",
      "    // ... your other modules",
      "  ],",
      "})",
      "export class AppModule {}",
    ],
  },
  fastapi: {
    label: "FastAPI",
    lines: [
      "# main.py",
      "from code_map import CodeMapPlugin",
      "",
      "app = FastAPI()",
      "",
      "CodeMapPlugin(app, port=7070)",
      "",
      "# That's it.",
    ],
  },
};

function InstallBlock() {
  const [fw, setFw] = useState<Framework>("nestjs");
  const block = CODE[fw];

  return (
    <div className="rounded-xl border border-white/10 bg-[#080808] overflow-hidden w-full max-w-2xl mx-auto">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-white/8">
        {(["nestjs", "fastapi"] as Framework[]).map((f) => (
          <button
            key={f}
            onClick={() => setFw(f)}
            className={`px-3 py-1 rounded-md text-[12px] font-mono transition-colors ${
              fw === f
                ? "bg-white/10 text-white border border-white/15"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {CODE[f].label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/8" />
          <div className="w-2 h-2 rounded-full bg-white/6" />
        </div>
      </div>
      {/* Code */}
      <motion.div
        key={fw}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_STANDARD}
        className="p-5 font-mono text-[13px] leading-6 flex flex-col gap-0"
      >
        {block.lines.map((line, i) => (
          <div key={i} className="flex items-start gap-4">
            <span className="w-5 text-right text-gray-700 shrink-0 select-none text-[11px] mt-px">
              {i + 1}
            </span>
            <span
              className={
                line.startsWith("//") || line.startsWith("#")
                  ? "text-gray-600"
                  : line === ""
                    ? "text-transparent"
                    : "text-gray-300"
              }
            >
              {line || " "}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-12 flex items-center border-b border-white/8 bg-black/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto w-full px-6 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-md flex items-center justify-center border border-white/12 bg-white/5 group-hover:border-white/25 group-hover:bg-white/8 transition-colors">
              <span className="font-mono text-[10px] font-bold text-white/70 tracking-tighter">
                fn
              </span>
            </div>
            <span className="font-mono text-[13px] font-bold tracking-tight text-white leading-none">
              code<span className="text-white/35">.</span>map
            </span>
          </a>

          {/* Right */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <motion.a
              href="/app"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SNAPPY}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors"
            >
              Open app
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="min-h-screen flex items-center pt-12">
        <div className="max-w-6xl mx-auto w-full px-6 py-28 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-14 items-center">
          {/* Copy */}
          <div className="flex flex-col gap-7">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.05 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/4 text-[11px] font-mono text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                Open source &nbsp;·&nbsp; NestJS &amp; FastAPI
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.1 }}
              className="text-[clamp(2.75rem,6vw,4.5rem)] font-bold tracking-tight leading-[1.04]"
            >
              See what your{" "}
              <br className="hidden sm:block" />
              endpoint{" "}
              <span className="text-white/35">actually</span>
              <br className="hidden sm:block" /> does.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.15 }}
              className="text-[17px] text-gray-400 leading-relaxed max-w-105"
            >
              code-map instruments your API and renders the full execution
              path — from route handler to database call — as an interactive
              call graph. Drop in a plugin. Open the dashboard. Done.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.2 }}
              className="flex flex-wrap items-center gap-3"
            >
              <motion.a
                href="/app"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING_SNAPPY}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-semibold text-[15px] hover:bg-white/90 transition-colors"
              >
                Try it now
                <ArrowRight className="w-4 h-4" />
              </motion.a>
              <motion.a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING_SNAPPY}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/12 bg-white/4 text-gray-400 font-medium text-[15px] hover:bg-white/8 hover:border-white/20 hover:text-white transition-colors"
              >
                <Github className="w-4 h-4" />
                Star on GitHub
              </motion.a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.28 }}
              className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-gray-700"
            >
              {["Next.js", "@xyflow/react", "dagre", "Framer Motion"].map(
                (dep, i) => (
                  <span key={dep} className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-white/4 border border-white/8 text-gray-600">
                      {dep}
                    </span>
                    {i < 3 && <span className="text-white/10">·</span>}
                  </span>
                )
              )}
            </motion.div>
          </div>

          {/* Hero video */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING_DEFAULT, delay: 0.18 }}
            className="relative"
          >
            <div className="absolute -inset-8 bg-white/2.5 rounded-3xl blur-3xl pointer-events-none" />
            <VideoPlaceholder
              label="hero-demo.mp4"
              className="relative aspect-4/3 w-full shadow-[0_0_100px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]"
            />
          </motion.div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="mb-16">
            <p className="text-[11px] font-mono text-gray-600 uppercase tracking-widest mb-4">
              How it works
            </p>
            <h2 className="text-4xl font-bold tracking-tight max-w-md">
              Two commands. Full picture.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Install the plugin",
                desc: "Add @code-map/nestjs or code-map (Python) to your project. One import, one line of config.",
                snippet: "npm i @code-map/nestjs",
              },
              {
                step: "02",
                title: "Start your server",
                desc: "Run your app normally. code-map instruments it at startup — no middleware wiring, no decorators on every route.",
                snippet: "npm run start:dev",
              },
              {
                step: "03",
                title: "Open the dashboard",
                desc: "Navigate to the code-map UI. Your endpoints are already there. Click any one to trace its full call chain.",
                snippet: "localhost:7070",
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.07}>
                <div className="flex flex-col gap-5 p-6 rounded-xl border border-white/8 bg-white/[0.018] h-full">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-gray-700 font-bold tracking-wider">
                      {item.step}
                    </span>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-auto font-mono text-[12px] text-gray-400 bg-black/60 border border-white/8 px-3 py-2 rounded-md">
                    <span className="text-gray-700 mr-2">$</span>
                    {item.snippet}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature: Call graph ───────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Reveal className="flex flex-col gap-6">
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-gray-600">
              <span className="w-5 h-px bg-white/15" />
              Call graphs
            </div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              The full call chain,
              <br />
              at a glance.
            </h2>
            <p className="text-gray-400 text-[16px] leading-relaxed max-w-100">
              Select any endpoint and see every function it touches — ordered
              by execution, visually connected. Hover a node to highlight its
              edges. Click to inspect.
            </p>
            <ul className="flex flex-col gap-3">
              {[
                "Auto-layout with dagre — no manual positioning",
                "Edge highlighting on hover to trace the path",
                "Inspect any node: file, line, docstring, AI summary",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-[13px] text-gray-500"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-700 mt-0.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <VideoPlaceholder
              label="call-graph-demo.mp4"
              className="aspect-4/3"
            />
          </Reveal>
        </div>
      </section>

      {/* ── Feature: Drill down ───────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Reveal delay={0.1} className="lg:order-last flex flex-col gap-6">
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-gray-600">
              <span className="w-5 h-px bg-white/15" />
              Drill-down
            </div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              Go as deep
              <br />
              as you need.
            </h2>
            <p className="text-gray-400 text-[16px] leading-relaxed max-w-100">
              Double-click any node to expand its own call chain. Navigate
              multiple levels with breadcrumbs. One click to go back — no
              browser history, no lost context.
            </p>
            <ul className="flex flex-col gap-3">
              {[
                "Unlimited drill depth",
                "Breadcrumb trail with copy support",
                "Directional spring animations on each transition",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-[13px] text-gray-500"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-700 mt-0.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="lg:order-first">
            <VideoPlaceholder
              label="drill-down-demo.mp4"
              className="aspect-4/3"
            />
          </Reveal>
        </div>
      </section>

      {/* ── Feature: AI enrichment ────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Reveal className="flex flex-col gap-6">
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-amber-700">
              <span className="w-5 h-px bg-amber-500/25" />
              AI enrichment
            </div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              Understand what
              <br />
              functions{" "}
              <span className="text-amber-400/90">actually</span> do.
            </h2>
            <p className="text-gray-400 text-[16px] leading-relaxed max-w-100">
              Amber nodes carry AI-generated intent tags and plain-English
              summaries. Get context without reading the source — then jump
              straight to it with one click.
            </p>
            <ul className="flex flex-col gap-3">
              {[
                "Intent tags visible on the node itself",
                "Full AI summary in the inspect panel",
                "Amber is semantically distinct — always means AI-enriched",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-[13px] text-gray-500"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <VideoPlaceholder
              label="ai-enrichment-demo.mp4"
              className="aspect-4/3"
            />
          </Reveal>
        </div>
      </section>

      {/* ── VS Code callout ───────────────────────────────────────────────── */}
      <section className="py-16 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="rounded-xl border border-white/10 bg-white/2 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-12">
              <div className="p-3 rounded-xl border border-white/10 bg-white/5 shrink-0">
                <ExternalLink className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <h3 className="text-2xl font-bold tracking-tight">
                  From graph to editor in one click.
                </h3>
                <p className="text-gray-500 text-[15px] max-w-lg">
                  Every node links directly to the exact line in VS Code. No
                  searching, no copy-pasting filenames, no lost context.
                </p>
              </div>
              <motion.a
                href="/app"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING_SNAPPY}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-[13px] hover:bg-white/90 transition-colors"
              >
                Try it
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Install ───────────────────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col items-center text-center gap-10">
          <Reveal>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-4">
              Get started in minutes.
            </h2>
            <p className="text-gray-500 text-[15px] max-w-sm mx-auto">
              No account. No config file. No instrumentation on every route.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="w-full">
            <InstallBlock />
          </Reveal>

          <Reveal delay={0.14}>
            <p className="text-[12px] font-mono text-gray-700">
              Then open{" "}
              <span className="text-gray-500 px-1.5 py-0.5 border border-white/8 rounded bg-white/3">
                localhost:7070
              </span>{" "}
              and select any endpoint.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <motion.a
                href="/app"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING_SNAPPY}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-black font-semibold text-[15px] hover:bg-white/90 transition-colors"
              >
                Open code-map
                <ArrowRight className="w-4 h-4" />
              </motion.a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[13px] text-gray-600 hover:text-gray-400 transition-colors"
              >
                <Github className="w-4 h-4" />
                View docs on GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center border border-white/10 bg-white/4">
              <span className="font-mono text-[9px] font-bold text-white/40 tracking-tighter">
                fn
              </span>
            </div>
            <span className="font-mono text-[12px] font-bold tracking-tight text-white/40">
              code<span className="text-white/15">.</span>map
            </span>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-gray-700">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              GitHub
            </a>
            <a href="/app" className="hover:text-gray-400 transition-colors">
              Open app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
