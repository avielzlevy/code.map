"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Github, ArrowRight, FunctionSquare } from "lucide-react";
import { SPRING_DEFAULT, SPRING_GENTLE, SPRING_SNAPPY, SPRING_STANDARD } from "@/lib/spring";
import { apiClient } from "@/lib/api-client";

// ─── Static graph preview ─────────────────────────────────────────────────────

/** Stagger variants for individual elements inside GraphPreview */
const previewItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: SPRING_GENTLE },
};

function DemoNode({
  funcName,
  file,
  enhanced,
  intentTag,
}: {
  funcName: string;
  file: string;
  enhanced?: boolean;
  intentTag?: string;
}) {
  return (
    <motion.div
      variants={previewItemVariants}
      whileHover={{ y: -2, transition: SPRING_STANDARD }}
      className={`relative w-full px-4 py-3 rounded-xl border bg-zinc-950 cursor-default ${
        enhanced
          ? "border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.08)] hover:border-amber-400/70"
          : "border-white/20 hover:border-white/35"
      } transition-[border-color]`}
    >
      {enhanced && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-linear-to-br from-amber-500/8 to-transparent" />
        </div>
      )}
      <div className="relative flex items-center gap-2.5">
        <div
          className={`p-1.5 rounded-lg border ${
            enhanced
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-white/5 border-white/10"
          }`}
        >
          <FunctionSquare
            className={`w-3.5 h-3.5 ${enhanced ? "text-amber-400" : "text-gray-400"}`}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className={`font-mono text-[13px] font-semibold truncate ${
              enhanced ? "text-amber-300" : "text-white"
            }`}
          >
            {funcName}
          </span>
          <span className="font-mono text-[11px] text-gray-600">{file}</span>
        </div>
      </div>
      {intentTag && (
        <div className="relative mt-2 text-[11px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-1 rounded-md flex items-center gap-1.5">
          <span className="w-1 h-1 shrink-0 rounded-full bg-amber-400" />
          {intentTag}
        </div>
      )}
    </motion.div>
  );
}

function GraphConnector() {
  return (
    <motion.div variants={previewItemVariants} className="flex flex-col items-center py-0.5">
      <div className="w-px h-7 bg-white/15" />
      <div
        className="w-0 h-0"
        style={{
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: "6px solid rgba(255,255,255,0.2)",
        }}
      />
    </motion.div>
  );
}

function GraphPreview() {
  return (
    <motion.div
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.11, delayChildren: 0.45 } },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="relative rounded-xl border border-white/8 bg-black px-6 py-7 flex flex-col items-stretch gap-0"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent rounded-t-xl" />

      {/* Switchboard chrome hint */}
      <motion.div variants={previewItemVariants} className="mb-5 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/15 bg-white/5 text-[10px] font-mono text-white/70">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
          GET
          <span className="text-white/40 ml-0.5">/api/users/profile</span>
        </div>
      </motion.div>

      <DemoNode funcName="AuthGuard.canActivate" file="auth.guard.ts:24" />
      <GraphConnector />
      <DemoNode funcName="UserController.getProfile" file="user.controller.ts:41" />
      <GraphConnector />
      <DemoNode
        funcName="UserService.findById"
        file="user.service.ts:88"
        enhanced
        intentTag="validates session · fetches user profile"
      />
      <GraphConnector />
      <DemoNode funcName="db.user.findUnique" file="prisma.service.ts:15" />
    </motion.div>
  );
}

// ─── Install block ────────────────────────────────────────────────────────────

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
    <div className="rounded-xl border border-white/10 bg-zinc-950 overflow-hidden w-full max-w-2xl mx-auto">
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
      </div>
      <motion.div
        key={fw}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_STANDARD}
        className="p-5 font-mono text-[13px] leading-6 flex flex-col"
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    n: "01",
    title: "From handler to database.",
    desc: "Every function call in the execution path, ordered and connected. Select an endpoint and the full graph appears.",
  },
  {
    n: "02",
    title: "Drill as deep as the stack goes.",
    desc: "Double-click any node to expand its sub-calls. Navigate multiple levels with breadcrumbs. One click to go back.",
  },
  {
    n: "03",
    title: "Know what it does before you open it.",
    desc: "Enriched functions carry a plain-English intent tag and AI summary — right on the graph. No file-opening required.",
  },
  {
    n: "04",
    title: "One click to the exact line.",
    desc: "Every node is a VS Code deep link. No searching, no copy-pasting filenames.",
  },
];

export default function LandingPage() {
  const [sidecarReachable, setSidecarReachable] = useState<boolean | null>(null);

  useEffect(() => {
    apiClient
      .healthCheck()
      .then(() => setSidecarReachable(true))
      .catch(() => setSidecarReachable(false));
  }, []);

  const appHref = sidecarReachable ? "/app" : undefined;
  const appDisabled = sidecarReachable === false;

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-12 flex items-center border-b border-white/8 bg-black">
        <div className="max-w-6xl mx-auto w-full px-6 flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/avielzlevy/code.map"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <motion.a
              href={appHref}
              whileHover={appDisabled ? {} : { scale: 1.02 }}
              whileTap={appDisabled ? {} : { scale: 0.97 }}
              transition={SPRING_SNAPPY}
              title={appDisabled ? "Your backend isn't running yet — start it first" : undefined}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                appDisabled
                  ? "bg-white/10 text-white/30 cursor-not-allowed"
                  : "bg-white text-black hover:bg-white/90"
              }`}
            >
              Open app
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="min-h-screen flex items-center pt-12">
        <div className="max-w-6xl mx-auto w-full px-6 py-24 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-14 items-center">
          {/* Copy */}
          <div className="flex flex-col gap-7">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.05 }}
            >
              <span className="font-mono text-[11px] text-white/25 tracking-[0.22em] uppercase select-none">
                API execution graph
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.1 }}
              className="text-[clamp(3.25rem,7.5vw,6rem)] font-black tracking-[-0.04em] leading-[0.96]"
            >
              See what your endpoint{" "}
              <br className="hidden lg:block" />
              actually does.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.15 }}
              className="text-[17px] text-gray-400 leading-relaxed max-w-md"
            >
              code-map instruments your API and renders the full execution
              path — from route handler to database call — as an interactive
              call graph. Drop in a plugin. Open the dashboard. Done.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: 0.2 }}
              className="flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center gap-3">
              <motion.a
                href={appHref}
                whileHover={appDisabled ? {} : { scale: 1.02 }}
                whileTap={appDisabled ? {} : { scale: 0.97 }}
                transition={SPRING_SNAPPY}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-[15px] transition-colors ${
                  appDisabled
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                Try it now
                <ArrowRight className="w-4 h-4" />
              </motion.a>
              <motion.a
                href="https://github.com/avielzlevy/code.map"
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
              </div>
              {appDisabled && sidecarReachable !== null && (
                <p className="text-[13px] text-gray-600 leading-snug">
                  Backend not detected — start your server with the plugin, then{" "}
                  <button
                    onClick={() => window.location.reload()}
                    className="text-gray-400 underline underline-offset-2 hover:text-white transition-colors cursor-pointer"
                  >
                    refresh
                  </button>
                  .
                </p>
              )}
            </motion.div>
          </div>

          {/* Graph preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING_DEFAULT, delay: 0.18 }}
          >
            <GraphPreview />
          </motion.div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ ...SPRING_DEFAULT, delay: i * 0.04 }}
              className={`grid grid-cols-1 md:grid-cols-[72px_1fr_1.4fr] gap-6 md:gap-10 py-12 items-start ${
                i < FEATURES.length - 1 ? "border-b border-white/8" : ""
              }`}
            >
              <span className="font-mono text-[42px] font-black text-white/7 leading-none tabular-nums select-none -mt-1.5">
                {f.n}
              </span>
              <h3 className="text-[21px] font-semibold tracking-tight text-white leading-snug">
                {f.title}
              </h3>
              <p className="text-[15px] text-gray-500 leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Install ───────────────────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col items-center text-center gap-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={SPRING_DEFAULT}
          >
            <h2 className="text-[clamp(2.25rem,5vw,3.75rem)] font-black tracking-[-0.03em] leading-[0.97] mb-4">
              Running in two minutes.
            </h2>
            <p className="text-gray-500 text-[15px]">
              No account. No config file. No decorator on every route.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ ...SPRING_DEFAULT, delay: 0.08 }}
            className="w-full"
          >
            <InstallBlock />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ ...SPRING_DEFAULT, delay: 0.14 }}
            className="text-[12px] font-mono text-gray-700"
          >
            Then open{" "}
            <span className="text-gray-500 px-1.5 py-0.5 border border-white/8 rounded bg-white/3">
              localhost:7070
            </span>{" "}
            and select any endpoint.
          </motion.p>

          <motion.a
            href={appHref}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={appDisabled ? {} : { scale: 1.02 }}
            whileTap={appDisabled ? {} : { scale: 0.97 }}
            transition={{ ...SPRING_DEFAULT, delay: 0.18 }}
            title={appDisabled ? "Your backend isn't running yet — start it first" : undefined}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-[15px] transition-colors ${
              appDisabled
                ? "bg-white/10 text-white/30 cursor-not-allowed"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            Open code-map
            <ArrowRight className="w-4 h-4" />
          </motion.a>
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
          <a
            href="https://github.com/avielzlevy/code.map"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-gray-700 hover:text-gray-400 transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
