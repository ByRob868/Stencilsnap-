import React, { useMemo, useRef, useState } from "react";

type Props = {
  beforeUrl?: string;
  afterUrl?: string;
};

export default function BeforeAfter({ beforeUrl, afterUrl }: Props) {
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const hasBoth = !!beforeUrl && !!afterUrl;

  const handle = (clientX: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setPos((x / rect.width) * 100);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    handle(e.clientX, e.currentTarget);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    handle(e.clientX, e.currentTarget);
  };

  const onUp = () => (dragging.current = false);

  const clip = useMemo(() => ({ width: `${pos}%` }), [pos]);
  const line = useMemo(() => ({ left: `${pos}%` }), [pos]);

  return (
    <div
      style={{ position: "relative", width: "100%", aspectRatio: "9/16", touchAction: "none" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {!hasBoth && (
        <div style={{ padding: 18, textAlign: "center", opacity: 0.7 }}>
          Upload een afbeelding om de preview te zien.
        </div>
      )}

      {beforeUrl && (
        <img
          src={beforeUrl}
          alt="before"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {afterUrl && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...clip }}>
          <img
            src={afterUrl}
            alt="after"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {hasBoth && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: 3,
              transform: "translateX(-50%)",
              background: "#8c5aff",
              ...line,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              transform: "translate(-50%,-50%)",
              background: "#8c5aff",
              borderRadius: 999,
              width: 48,
              height: 48,
              display: "grid",
              placeItems: "center",
              ...line,
            }}
          >
            ↔
          </div>
          <div style={{ position: "absolute", left: 10, top: 10, fontSize: 12, opacity: 0.8 }}>Original</div>
          <div style={{ position: "absolute", right: 10, top: 10, fontSize: 12, opacity: 0.8 }}>Stencil</div>
        </>
      )}
    </div>
  );
    }
