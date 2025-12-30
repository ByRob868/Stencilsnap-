import React, { useEffect, useMemo, useRef, useState } from "react";
import BeforeAfter from "./BeforeAfter";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function App() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // sliders (voor later: we sturen ze nu nog niet naar backend, maar UI staat klaar)
  const [lineWeight, setLineWeight] = useState(3);
  const [detail, setDetail] = useState(4);

  const [beforeUrl, setBeforeUrl] = useState<string | undefined>();
  const [afterUrl, setAfterUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBeforeUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = () => fileRef.current?.click();

  const onFile = async (f: File) => {
    setErr(null);
    setAfterUrl(undefined);
    setFile(f);
  };

  // auto-generate stencil zodra file of sliders veranderen (debounce)
  useEffect(() => {
    if (!file) return;

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);

        const form = new FormData();
        form.append("file", file);

        // NOTE: sliders nog niet in backend; volgende stap voegen we params toe
        // form.append("lineWeight", String(lineWeight));
        // form.append("detail", String(detail));

        const res = await fetch(`${API_BASE}/stencil`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) throw new Error(`Backend error (${res.status})`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAfterUrl(url);
      } catch (e: any) {
        setErr(e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [file, lineWeight, detail]);

  const hint = useMemo(() => {
    if (!file) return "Upload → direct stencil preview (paars).";
    if (loading) return "Bezig met genereren…";
    return "Sleep de ↔ knop om original vs stencil te vergelijken.";
  }, [file, loading]);

  return (
    <div className="container">
      <div className="h1">
        <div className="badge">S</div>
        StencilSnap
      </div>

      <div className="card row">
        <div className="previewWrap">
          <BeforeAfter beforeUrl={beforeUrl} afterUrl={afterUrl} />
        </div>

        <div className="controls">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />

          <button className="btn" onClick={pickFile}>
            Upload image
          </button>

          <div className="label">
            <span>Line weight</span><span>{lineWeight}</span>
          </div>
          <input
            className="slider"
            type="range"
            min={1}
            max={8}
            value={lineWeight}
            onChange={(e) => setLineWeight(parseInt(e.target.value))}
          />

          <div className="label">
            <span>Detail</span><span>{detail}</span>
          </div>
          <input
            className="slider"
            type="range"
            min={1}
            max={8}
            value={detail}
            onChange={(e) => setDetail(parseInt(e.target.value))}
          />

          {err && <div className="note" style={{ color: "#ff6b6b" }}>{err}</div>}
          <div className="note">{hint}</div>
          <div className="note">
            Tip: als je backend niet op 5000 draait, zet in frontend een env:
            <br />
            <b>VITE_API_BASE</b> = jouw backend url
          </div>
        </div>
      </div>
    </div>
  );
}
