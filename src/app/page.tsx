"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseBom }  from "@/lib/utils/bom-parser";

const PLACEHOLDER = `LM358N 100
BC547B 500
100nF 0402 2000
STM32F103C8T6 10`;

export default function HomePage() {
  const router  = useRouter();
  const [input, setInput]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  function handleSearch() {
    setError("");
    const bom = parseBom(input);
    if (bom.length === 0) {
      setError("No valid components found. Enter one MPN and quantity per line, e.g.: LM358N 100");
      return;
    }
    setLoading(true);
    // Encode BOM in URL as base64 to pass to results page
    const encoded = btoa(JSON.stringify(bom));
    router.push(`/results?bom=${encoded}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSearch();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">

      {/* Logo / Headline */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          ic<span className="text-sky-400">paste</span>
          <span className="text-gray-500">.com</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          Paste your BOM. Get the best price and stock across{" "}
          <span className="text-gray-200">Mouser</span>,{" "}
          <span className="text-gray-200">Digi-Key</span> and{" "}
          <span className="text-gray-200">Farnell</span>.
          <br />No signup. Instant results.
        </p>
      </div>

      {/* Input Card */}
      <div className="card w-full max-w-2xl p-6">
        <label className="block text-sm text-gray-400 mb-2 font-medium">
          Paste your BOM — one component per line
          <span className="ml-2 text-gray-600 font-normal">(MPN &nbsp;QTY)</span>
        </label>

        <textarea
          className="w-full h-48 bg-gray-950 border border-gray-700 rounded-lg p-4
                     font-mono text-sm text-gray-100 placeholder-gray-600
                     focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500
                     resize-none transition-colors"
          placeholder={PLACEHOLDER}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-600">
            Supports CSV, tab-separated or space-separated. Max 100 components.
          </p>
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={loading || input.trim().length === 0}
          >
            {loading ? "Searching…" : "Find best prices →"}
          </button>
        </div>
      </div>

      {/* Supported distributors */}
      <div className="flex items-center gap-3 mt-8 text-xs text-gray-600">
        <span>Searches:</span>
        {["Mouser", "Digi-Key", "Farnell"].map(d => (
          <span key={d} className="tag-rounded bg-gray-800 text-gray-400">{d}</span>
        ))}
      </div>

      <footer className="mt-16 text-xs text-gray-700">
        © {new Date().getFullYear()} icpaste.com — Built for hardware buyers
      </footer>
    </main>
  );
}
