"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children:  React.ReactNode;  // il badge
  title:     string;
  detail:    string;
  saving?:   string;           // es. "saves USD 3.20"
}

export function Tooltip({ children, title, detail, saving }: TooltipProps) {
  const [visible, setVisible]   = useState(false);
  const [pos, setPos]           = useState({ top: 0, left: 0 });
  const [mounted, setMounted]   = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const show = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top:  rect.top + window.scrollY - 8,   // sopra il badge
      left: rect.left + rect.width / 2 + window.scrollX,
    });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  const tooltip = visible && mounted ? createPortal(
    <div style={{
      position:      "absolute",
      top:           pos.top,
      left:          pos.left,
      transform:     "translate(-50%, -100%)",
      zIndex:        99999,
      pointerEvents: "none",
      animation:     "fadeUpTooltip 0.15s ease forwards",
    }}>
      {/* Box */}
      <div style={{
        background:    "#1a1a1f",
        color:         "#f1f5f9",
        fontSize:      "11px",
        fontFamily:    "Inter, sans-serif",
        fontWeight:    500,
        lineHeight:    1.65,
        padding:       "8px 13px",
        borderRadius:  "8px",
        boxShadow:     "0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)",
        textAlign:     "center",
        whiteSpace:    "nowrap",
      }}>
        {/* Titolo */}
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        {/* Dettaglio */}
        <div style={{ color: "#64748b", fontSize: 10 }}>{detail}</div>
        {/* Risparmio */}
        {saving && (
          <div style={{
            marginTop:   5,
            fontWeight:  700,
            fontSize:    12,
            color:       "#4ade80",
            letterSpacing: "-0.2px",
          }}>
            {saving}
          </div>
        )}
      </div>
      {/* Freccia */}
      <div style={{
        position:    "absolute",
        top:         "100%",
        left:        "50%",
        transform:   "translateX(-50%)",
        width:       0,
        height:      0,
        borderLeft:  "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop:   "5px solid #1a1a1f",
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
