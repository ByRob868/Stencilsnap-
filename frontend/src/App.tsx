import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// simpele debounce hook
function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [stencilUrl, setStencilUrl] = useState<string>("");

  const [lineWeight, setLineWeight] = useState<number>(3);
  const [detail, setDetail] = useState<number>(4);

  const [split, setSplit] = useState<number>(50); // before/after slider %
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");

  const debouncedLineWeight = useDebounced(lineWeight, 350);
  const debouncedDetail = useDebounced(detail, 350);

  // cleanup object urls
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (stencilUrl) URL.revokeObjectURL(stencilUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canProcess = useMemo(() => !!selectedFile, [selectedFile]);

  async function generateStencil(file: File, lw: number, dt: number) {
    setErr("");
    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const url = `${API_BASE}/stencil?lineWeight=${encodeURIComponent(
        lw
      )}&detail=${encodeURIComponent(dt)}`;

      const res = await fetch(url, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Backend error (${res.status})`);
      }

      const blob = await res.blob();
      const next = URL.createObjectURL(blob);

      // revoke previous stencil url
      if (stencilUrl) URL.revokeObjectURL(stencilUrl);
      setStencilUrl(next);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong generating the stencil.");
    } finally {
      setLoading(false);
    }
  }

  // Handle file selection
  const onPickFile = (file: File) => {
    // basic guard
    if (!file.type.startsWith("image/")) {
      setErr("Upload a valid image file (jpg/png/webp).");
      return;
    }

    setSelectedFile(file);
    setErr("");

    // show original immediately
    const nextOriginal = URL.createObjectURL(file);
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setOriginalUrl(nextOriginal);

    // reset slider center each upload
    setSplit(50);

    // generate immediately
    generateStencil(file, lineWeight, detail);
  };

  // When sliders change, re-generate (debounced)
  useEffect(() => {
    if (!selectedFile) return;
    generateStencil(selectedFile, debouncedLineWeight, debouncedDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLineWeight, debouncedDetail, selectedFile]);

  // Drag & drop
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onPickFile(file);
  };

  const onBrowseClick = () => fileInputRef.current?.click();

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.logo} />
            <div>
              <div style={styles.title}>StencilSnap</div>
              <div style={styles.subtitle}>
                Professional tattoo stencil preview — instant & adjustable
              </div>
            </div>
          </div>
        </header>

        <main style={styles.main}>
          {/* Upload card */}
          <section style={styles.card}>
            <div
              style={{
                ...styles.drop,
                ...(canProcess ? styles.dropSmall : null),
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={onBrowseClick}
              role="button"
              aria-label="Upload image"
            >
              {!canProcess ? (
                <>
                  <div style={styles.uploadIcon}>☁️</div>
                  <div style={styles.dropTitle}>Drop Reference Image</div>
                  <div style={styles.dropHint}>
                    Tap to browse — portrait, animal, or tattoo reference
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.dropTitle}>Change image</div>
                  <div style={styles.dropHint}>Tap to upload a new one</div>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                  // allow re-upload same file
                  e.currentTarget.value = "";
                }}
              />
            </div>

            {/* Controls */}
            <div style={styles.controls}>
              <div style={styles.controlGroup}>
                <div style={styles.controlLabelRow}>
                  <div style={styles.controlLabel}>LINE WEIGHT</div>
                  <div style={styles.controlValue}>{lineWeight}</div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={lineWeight}
                  onChange={(e) => setLineWeight(parseInt(e.target.value, 10))}
                  style={styles.range}
                  disabled={!canProcess}
                />
              </div>

              <div style={styles.controlGroup}>
                <div style={styles.controlLabelRow}>
                  <div style={styles.controlLabel}>DETAIL</div>
                  <div style={styles.controlValue}>{detail}</div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={detail}
                  onChange={(e) => setDetail(parseInt(e.target.value, 10))}
                  style={styles.range}
                  disabled={!canProcess}
                />
              </div>
            </div>

            {/* Status */}
            <div style={styles.statusRow}>
              {loading ? (
                <div style={styles.status}>Generating stencil…</div>
              ) : canProcess ? (
                <div style={styles.statusOk}>Ready</div>
              ) : (
                <div style={styles.statusMuted}>Upload an image to start</div>
              )}

              {err ? <div style={styles.error}>{err}</div> : null}
            </div>
          </section>

          {/* Preview card */}
          <section style={styles.previewCard}>
            <div style={styles.previewHeader}>
              <div style={styles.previewTitle}>Preview</div>
              <div style={styles.previewHint}>
                Drag the handle to compare original vs stencil
              </div>
            </div>

            <div style={styles.previewStage}>
              {!originalUrl ? (
                <div style={styles.previewEmpty}>
                  Upload an image to see the before/after preview.
                </div>
              ) : (
                <div style={styles.compareWrap}>
                  {/* Original as base */}
                  <img
                    src={originalUrl}
                    alt="Original"
                    style={styles.previewImg}
                  />

                  {/* Stencil overlay clipped */}
                  {stencilUrl ? (
                    <img
                      src={stencilUrl}
                      alt="Stencil"
                      style={{
                        ...styles.previewImg,
                        position: "absolute",
                        inset: 0,
                        clipPath: `inset(0 ${100 - split}% 0 0)`,
                      }}
                    />
                  ) : null}

                  {/* Divider line */}
                  <div
                    style={{
                      ...styles.divider,
                      left: `${split}%`,
                    }}
                  />

                  {/* Handle */}
                  <div
                    style={{
                      ...styles.handle,
                      left: `${split}%`,
                    }}
                  >
                    <div style={styles.handleKnob}>↔</div>
                  </div>

                  {/* Slider input (invisible, over whole preview) */}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={split}
                    onChange={(e) =>
                      setSplit(clamp(parseInt(e.target.value, 10), 0, 100))
                    }
                    style={styles.splitRange}
                    aria-label="Before/after slider"
                    disabled={!stencilUrl}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={styles.actionsRow}>
              <button
                style={styles.btn}
                onClick={onBrowseClick}
                type="button"
              >
                New Image
              </button>

              <a
                style={{
                  ...styles.btnPrimary,
                  ...(stencilUrl ? {} : styles.btnDisabled),
                }}
                href={stencilUrl || "#"}
                download="stencil.png"
                onClick={(e) => {
                  if (!stencilUrl) e.preventDefault();
                }}
              >
                Download PNG
              </a>
            </div>
          </section>
        </main>

        <footer style={styles.footer}>
          <span style={styles.footerText}>
            Tip: For portraits, start with Line Weight 3–4 and Detail 4–6.
          </span>
        </footer>
      </div>
    </div>
  );
}

/** Minimal inline styles (no CSS file needed) */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1000px 500px at 50% 0%, rgba(140,90,255,.25), rgba(0,0,0,0))",
    backgroundColor: "#070816",
    color: "#EDEBFF",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    padding: "18px 14px",
  },
  shell: {
    maxWidth: 820,
    margin: "0 auto",
  },
  header: {
    marginBottom: 14,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(140,90,255,1), rgba(55,30,130,1))",
    boxShadow: "0 10px 30px rgba(140,90,255,.25)",
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.8,
    marginTop: 2,
  },
  main: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
  },
  card: {
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 20px 50px rgba(0,0,0,.35)",
  },
  drop: {
    border: "2px dashed rgba(255,255,255,.18)",
    borderRadius: 16,
    padding: "28px 16px",
    cursor: "pointer",
    textAlign: "center",
    background: "rgba(0,0,0,.25)",
  },
  dropSmall: {
    padding: "14px 16px",
  },
  uploadIcon: {
    fontSize: 26,
    marginBottom: 8,
  },
  dropTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  dropHint: {
    fontSize: 13,
    opacity: 0.8,
    marginTop: 6,
  },
  controls: {
    display: "grid",
    gap: 12,
    marginTop: 14,
  },
  controlGroup: {},
  controlLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  controlLabel: {
    fontSize: 12,
    letterSpacing: 1,
    opacity: 0.8,
    fontWeight: 700,
  },
  controlValue: {
    fontSize: 12,
    opacity: 0.9,
    fontWeight: 700,
  },
  range: {
    width: "100%",
    accentColor: "#8C5AFF",
  },
  statusRow: {
    marginTop: 10,
    display: "grid",
    gap: 8,
  },
  status: {
    fontSize: 13,
    opacity: 0.9,
  },
  statusOk: {
    fontSize: 13,
    color: "rgba(140,90,255,1)",
    fontWeight: 700,
  },
  statusMuted: {
    fontSize: 13,
    opacity: 0.7,
  },
  error: {
    fontSize: 13,
    color: "#FF6B6B",
    background: "rgba(255,107,107,.12)",
    border: "1px solid rgba(255,107,107,.25)",
    padding: "10px 12px",
    borderRadius: 12,
  },
  previewCard: {
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 20px 50px rgba(0,0,0,.35)",
  },
  previewHeader: {
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 800,
  },
  previewHint: {
    fontSize: 13,
    opacity: 0.75,
    marginTop: 2,
  },
  previewStage: {
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(0,0,0,.25)",
    border: "1px solid rgba(255,255,255,.08)",
  },
  previewEmpty: {
    padding: 24,
    textAlign: "center",
    opacity: 0.75,
    fontSize: 13,
  },
  compareWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    maxHeight: 520,
  },
  previewImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    background: "#0b0c1a",
  },
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    transform: "translateX(-1px)",
    background: "rgba(140,90,255,0.9)",
    boxShadow: "0 0 0 1px rgba(140,90,255,0.25)",
    pointerEvents: "none",
  },
  handle: {
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  handleKnob: {
    width: 44,
    height: 44,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(140,90,255,0.92)",
    color: "#0b0c1a",
    fontWeight: 900,
    boxShadow: "0 10px 30px rgba(140,90,255,.25)",
  },
  splitRange: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "ew-resize",
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.10)",
    color: "#EDEBFF",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    textDecoration: "none",
  },
  btnPrimary: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(140,90,255,0.95)",
    border: "1px solid rgba(140,90,255,0.35)",
    color: "#0b0c1a",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "center",
    textDecoration: "none",
  },
  btnDisabled: {
    opacity: 0.5,
    pointerEvents: "none",
  },
  footer: {
    marginTop: 12,
    opacity: 0.7,
    fontSize: 12,
    textAlign: "center",
  },
  footerText: {},
};
