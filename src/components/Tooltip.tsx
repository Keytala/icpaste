"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: React.ReactNode;
  title:    string;
  detail:   string;
  saving?:  string;
}

export function Tooltip({ children, title, detail, saving }: TooltipProps) {
  const [visible, setVisible]   = useState(false);
  const [pos, setPos]           = useState({ top: 0, left: 0 });
  const [mounted, setMounted]   = useState(false);
  const ref                     = useRef<HTMLSpanElement>(null);
  const tooltipRef              = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const show = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top:  rect.top,        // top del badge nel viewport
      left: rect.left + rect.width / 2,  // centro orizzontale del badge
    });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  const tooltip = visible && mounted ? createPortal(
    <div
      ref={tooltipRef}
      style={{
        position:      "fixed",
        top:           pos.top,
        left:          pos.left,
        // sposta il tooltip sopra il badge:
        // -100% = altezza del tooltip, -8px = gap dal badge
        transform:     "translate(-50%, calc(-100% - 8px))",
        zIndex:        99999,
        pointerEvents: "none",
      }}
    >
      {/* Box */}
      <div style={{
        background:   "#f9fafb",
        color:        "#111827",
        fontSize:     "11px",
        fontFamily:   "Inter, sans-serif",
        fontWeight:   500,
        lineHeight:   1.65,
        padding:      "8px 13px",
        borderRadius: "8px",
        border:       "1px solid #e5e7eb",
        boxShadow:    "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)",
        textAlign:    "center",
        whiteSpace:   "nowrap",
      }}>
        <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ color: "#6b7280", fontSize: 10 }}>
          {detail}
        </div>
        {saving && (
          <div style={{
            marginTop:     5,
            fontWeight:    700,
            fontSize:      12,
            color:         "#16a34a",
            letterSpacing: "-0.2px",
          }}>
            {saving}
          </div>
        )}
      </div>

      {/* Freccia bordo */}
      <div style={{
        position:    "absolute",
        top:         "100%",
        left:        "50%",
        transform:   "translateX(-50%)",
        width:       0,
        height:      0,
        borderLeft:  "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop:   "5px solid #e5e7eb",
      }} />
      {/* Freccia fill */}
      <div style={{
        position:    "absolute",
        top:         "calc(100% - 1px)",
        left:        "50%",
        transform:   "translateX(-50%)",
        width:       0,
        height:      0,
        borderLeft:  "4px solid transparent",
        borderRight: "4px solid transparent",
        borderTop:   "4px solid #f9fafb",
      }} />
    </div>,
    document.body
  ) : null;

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
