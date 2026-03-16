"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  ArrowRight,
  FunctionSquare,
  Layers,
  ExternalLink,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { SPRING_DEFAULT, SPRING_SNAPPY, SPRING_STANDARD } from "@/lib/spring";
import { apiClient } from "@/lib/api-client";

// ─── Demo video ───────────────────────────────────────────────────────────────

function DemoVideo() {
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black select-none">
      <video
        src="/code.map_demo.mov"
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-auto block"
      />
    </div>
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

// ─── Interactive walkthrough ──────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Select any endpoint.",
    desc: "The full execution path appears instantly — every function call, ordered and connected.",
  },
  {
    n: "02",
    title: "Click any node.",
    desc: "See the AI summary, file path, and docstring. No file-opening required.",
  },
  {
    n: "03",
    title: "Jump to the exact line.",
    desc: "Every node is a VS Code deep link. One click — the file opens at the exact line.",
  },
];

const STEP_DURATION = 4500;

function MockStep1() {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Endpoint switcher */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { method: "GET", path: "/users/:id", active: true },
          { method: "POST", path: "/users", active: false },
          { method: "DELETE", path: "/users/:id", active: false },
        ].map((ep, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono select-none ${
              ep.active
                ? "bg-white/8 border border-white/15 text-white/80"
                : "text-gray-600 border border-transparent"
            }`}
          >
            <span
              className={`text-[10px] font-bold ${
                ep.method === "GET"
                  ? "text-blue-400"
                  : ep.method === "POST"
                    ? "text-green-400"
                    : "text-gray-500"
              }`}
            >
              {ep.method}
            </span>
            <span>{ep.path}</span>
          </div>
        ))}
      </div>

      {/* Mini call graph */}
      <div className="rounded-xl border border-white/8 bg-black/40 p-5 overflow-x-auto">
        <div className="flex items-center gap-2 w-max">
          {[
            {
              label: "getUserById",
              file: "user.service.ts",
              enhanced: true,
              tag: "DB → fetch by ID",
            },
            { label: "UserRepo.find", file: "user.repo.ts", enhanced: false, tag: undefined },
            { label: "db.query", file: "database.ts", enhanced: false, tag: undefined },
          ].map((node, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`rounded-lg border px-3 py-2.5 min-w-[130px] ${
                  node.enhanced
                    ? "border-amber-500/40 bg-zinc-950 shadow-[0_0_18px_rgba(245,158,11,0.12)]"
                    : "border-white/12 bg-zinc-950"
                }`}
              >
                <div
                  className={`text-[12px] font-semibold font-mono ${
                    node.enhanced ? "text-amber-300" : "text-white/80"
                  }`}
                >
                  {node.label}
                </div>
                <div className="text-[10px] text-gray-600 font-mono mt-0.5">{node.file}</div>
                {node.tag && (
                  <div className="mt-2 text-[10px] font-mono bg-amber-500/8 border border-amber-500/15 text-amber-400/70 px-1.5 py-0.5 rounded-md">
                    {node.tag}
                  </div>
                )}
              </div>
              {i < 2 && (
                <div className="flex items-center shrink-0">
                  <div className="w-6 h-px bg-white/15" />
                  <div
                    className="w-0 h-0"
                    style={{
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                      borderLeft: "5px solid rgba(255,255,255,0.2)",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockStep2() {
  return (
    <div className="flex justify-center w-full">
      <div className="relative rounded-xl bg-zinc-950 border border-amber-500/40 shadow-[0_4px_30px_rgba(245,158,11,0.12)] overflow-hidden w-full max-w-xs">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/6 to-transparent pointer-events-none" />

        {/* Node header */}
        <div className="relative px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <FunctionSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-amber-300 font-mono">getUserById</div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">user.service.ts</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-mono text-amber-400/70 bg-amber-500/8 border border-amber-500/15 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            DB → fetch user by ID
          </div>
        </div>

        {/* Expanded panel */}
        <div className="border-t border-amber-500/15">
          <div className="px-4 pt-2.5 pb-2">
            <span className="font-mono text-[10px] text-gray-500">
              src/users/user.service.ts:42
            </span>
          </div>
          <div className="px-4 pb-3">
            <div className="relative p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <Sparkles className="absolute top-2 right-2 w-3 h-3 text-amber-400/30" />
              <p className="text-[11px] text-gray-400 leading-relaxed pr-4">
                Fetches a user record from the database by ID. Returns{" "}
                <code className="text-white/60 font-mono">null</code> if no match is found.
              </p>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3">
            <div className="flex-1 flex items-center justify-center gap-1.5 bg-white text-black py-1.5 rounded-md text-[11px] font-semibold select-none">
              <Layers className="w-3 h-3" />
              Drill into calls
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 border border-white/15 text-gray-400 py-1.5 rounded-md text-[11px] select-none">
              <ExternalLink className="w-3 h-3" />
              Open in VS Code
            </div>
          </div>
        </div>

        <div className="border-t border-amber-500/15 h-6 flex items-center justify-center">
          <ChevronDown className="w-3 h-3 text-amber-400/60 rotate-180" />
        </div>
      </div>
    </div>
  );
}

function MockStep3() {
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setClicked(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Button */}
      <div className="relative">
        {clicked && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 rounded-md border border-white/40"
          />
        )}
        <motion.div
          animate={clicked ? { scale: [1, 0.93, 1] } : {}}
          transition={{ duration: 0.12 }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium border transition-colors select-none ${
            clicked
              ? "border-white/30 text-white bg-white/6"
              : "border-white/15 text-gray-400"
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in VS Code
        </motion.div>
      </div>

      {/* Code reveal */}
      <AnimatePresence>
        {clicked && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_DEFAULT}
            className="rounded-xl border border-white/10 bg-zinc-950 overflow-hidden w-full max-w-sm"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-white/8" />
                ))}
              </div>
              <span className="text-[10px] text-gray-600 font-mono ml-1">
                src/users/user.service.ts
              </span>
            </div>
            <div className="font-mono text-[11px] leading-relaxed py-1">
              {[
                { n: 40, code: "  async getUserById(id: string) {", hl: false },
                { n: 41, code: "    const user = await this.userRepo", hl: false },
                { n: 42, code: "      .find({ where: { id } });", hl: true },
                { n: 43, code: "    return user ?? null;", hl: false },
                { n: 44, code: "  }", hl: false },
              ].map((line) => (
                <div
                  key={line.n}
                  className={`flex items-stretch ${line.hl ? "bg-white/6" : ""}`}
                >
                  {line.hl && <div className="w-0.5 bg-white/45 shrink-0" />}
                  <div className={`flex items-center gap-3 py-0.5 ${line.hl ? "px-3" : "px-4"}`}>
                    <span className="w-4 text-right text-gray-700 text-[10px] shrink-0 select-none">
                      {line.n}
                    </span>
                    <span className={line.hl ? "text-white/85" : "text-gray-500"}>{line.code}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {clicked && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, ...SPRING_DEFAULT }}
          className="text-[11px] font-mono text-gray-600 text-center"
        >
          Opened{" "}
          <span className="text-gray-500 px-1 py-0.5 bg-white/3 border border-white/8 rounded">
            user.service.ts:42
          </span>{" "}
          in VS Code
        </motion.p>
      )}
    </div>
  );
}

function WalkthroughSection() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (paused) return;
    setSession((s) => s + 1);
    const id = setTimeout(() => setStep((s) => (s + 1) % 3), STEP_DURATION);
    return () => clearTimeout(id);
  }, [step, paused]);

  return (
    <section className="py-28 border-t border-white/8">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={SPRING_DEFAULT}
          className="mb-14"
        >
          <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-black tracking-[-0.03em] leading-[0.97]">
            How it works.
          </h2>
          <p className="text-gray-500 text-[15px] mt-3">
            Three interactions. That&apos;s the entire interface.
          </p>
        </motion.div>

        <div
          className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 items-start"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Step list */}
          <div className="flex flex-col gap-1">
            {STEPS.map((s, i) => {
              const isActive = step === i;
              return (
                <button
                  key={s.n}
                  onClick={() => setStep(i)}
                  className={`w-full text-left px-4 py-4 rounded-xl transition-colors group ${
                    isActive
                      ? "bg-white/4 border border-white/10"
                      : "hover:bg-white/3 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      className={`font-mono text-[11px] mt-0.5 tabular-nums shrink-0 transition-colors ${
                        isActive ? "text-white/45" : "text-white/15"
                      }`}
                    >
                      {s.n}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[14px] font-semibold tracking-tight transition-colors ${
                          isActive ? "text-white" : "text-white/35 group-hover:text-white/55"
                        }`}
                      >
                        {s.title}
                      </div>
                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={SPRING_DEFAULT}
                            className="overflow-hidden"
                          >
                            <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed">
                              {s.desc}
                            </p>
                            {!paused && (
                              <div className="mt-3 h-px bg-white/8 rounded-full overflow-hidden">
                                <motion.div
                                  key={session}
                                  className="h-full bg-white/30 rounded-full"
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{
                                    duration: STEP_DURATION / 1000,
                                    ease: "linear",
                                  }}
                                />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mockup panel */}
          <div className="rounded-2xl border border-white/8 bg-zinc-950/30 p-6 min-h-72 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SPRING_DEFAULT}
                className="w-full"
              >
                {step === 0 && <MockStep1 />}
                {step === 1 && <MockStep2 />}
                {step === 2 && <MockStep3 />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
              call graph. Drop in a plugin. Open the canvas. Done.
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

          {/* Demo video */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING_DEFAULT, delay: 0.18 }}
          >
            <DemoVideo />
          </motion.div>
        </div>
      </section>

      {/* ── Walkthrough ───────────────────────────────────────────────────── */}
      <WalkthroughSection />

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
