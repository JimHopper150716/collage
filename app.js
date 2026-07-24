const { useState, useRef, useEffect, useCallback } = React;

// Tiny inline-SVG icon set (avoids any extra dependency / CDN for icons)
function Icon({ children, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const Upload = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Icon>;
const Sparkles = (p) => <Icon {...p}><path d="M12 3l1.9 4.8L19 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5 9.7l4.8-1.9L12 3z" /><path d="M5 3v3M19 17v3M3 19h3M17 5h3" /></Icon>;
const Download = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Icon>;
const Trash2 = (p) => <Icon {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Icon>;
const Copy = (p) => <Icon {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>;
const ChevronsUp = (p) => <Icon {...p}><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></Icon>;
const ChevronsDown = (p) => <Icon {...p}><polyline points="7 13 12 18 17 13" /><polyline points="7 6 12 11 17 6" /></Icon>;
const RotateCw = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></Icon>;

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
`;

const CANVAS_PRESETS = [
  { key: "square", label: "Square", w: 1080, h: 1080 },
  { key: "landscape", label: "Landscape", w: 1400, h: 1000 },
  { key: "portrait", label: "Portrait", w: 1000, h: 1400 },
  { key: "story", label: "Story", w: 900, h: 1600 },
  { key: "wide", label: "Widescreen", w: 1600, h: 900 },
];

const BG_OPTIONS = [
  { key: "paper", label: "Paper", value: "#F6F1E7" },
  { key: "white", label: "White", value: "#FFFFFF" },
  { key: "black", label: "Black", value: "#0B0B0C" },
  { key: "transparent", label: "Transparent", value: "transparent" },
];

const ACCENT = "#FF5A36";

function rotateVec(x, y, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageDims(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    img.onerror = () => resolve({ naturalWidth: 1, naturalHeight: 1 });
    img.src = src;
  });
}

function makeId() {
  return "img-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Justified-gallery style layout that fills the canvas edge to edge.
function computeAutoFit(images, canvasW, canvasH, gap) {
  const n = images.length;
  if (n === 0) return [];
  const aspects = images.map((im) => (im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1));

  function layoutForRowHeight(targetH) {
    const rows = [];
    let current = [];
    let sumAspect = 0;
    for (let i = 0; i < n; i++) {
      current.push(i);
      sumAspect += aspects[i];
      const rowWidth = targetH * sumAspect + gap * (current.length - 1);
      if (rowWidth >= canvasW) {
        rows.push({ items: current, aspectSum: sumAspect });
        current = [];
        sumAspect = 0;
      }
    }
    if (current.length) rows.push({ items: current, aspectSum: sumAspect });
    const rowHeights = rows.map((r) => {
      const availW = canvasW - gap * (r.items.length - 1);
      return Math.max(1, availW / r.aspectSum);
    });
    const totalH = rowHeights.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
    return { rows, rowHeights, totalH };
  }

  let lo = 8, hi = Math.max(canvasH * 2, 200);
  let result = layoutForRowHeight(lo);
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const res = layoutForRowHeight(mid);
    if (res.totalH > canvasH) hi = mid;
    else { lo = mid; result = res; }
  }

  const positioned = [];
  let y = 0;
  result.rows.forEach((row, ri) => {
    let x = 0;
    const rh = result.rowHeights[ri];
    row.items.forEach((idx) => {
      const w = rh * aspects[idx];
      positioned.push({ id: images[idx].id, x, y, width: w, height: rh });
      x += w + gap;
    });
    y += rh + gap;
  });
  return positioned;
}

function CollageMaker() {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [preset, setPreset] = useState(CANVAS_PRESETS[0]);
  const [bg, setBg] = useState(BG_OPTIONS[0]);
  const [gap, setGap] = useState(8);
  const [scale, setScale] = useState(1);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const fileInputRef = useRef(null);
  const interactionRef = useRef(null);

  const canvasW = preset.w;
  const canvasH = preset.h;

  // Fit canvas to viewport
  useEffect(() => {
    function recompute() {
      const vp = viewportRef.current;
      if (!vp) return;
      const availW = vp.clientWidth - 48;
      const availH = vp.clientHeight - 48;
      const s = Math.min(availW / canvasW, availH / canvasH, 1);
      setScale(Math.max(s, 0.05));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [canvasW, canvasH]);

  const updateImage = useCallback((id, patch) => {
    setImages((prev) => prev.map((im) => (im.id === id ? { ...im, ...patch } : im)));
  }, []);

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const loaded = await Promise.all(
      files.map(async (file) => {
        const src = await readAsDataURL(file);
        const { naturalWidth, naturalHeight } = await loadImageDims(src);
        return { src, naturalWidth, naturalHeight };
      })
    );
    setImages((prev) => {
      const startCount = prev.length;
      const next = loaded.map(({ src, naturalWidth, naturalHeight }, i) => {
        const aspect = naturalWidth / naturalHeight || 1;
        const base = Math.min(canvasW, canvasH) * 0.36;
        let w, h;
        if (aspect >= 1) { w = base; h = base / aspect; } else { h = base; w = base * aspect; }
        const margin = 24;
        const maxX = Math.max(margin, canvasW - w - margin);
        const maxY = Math.max(margin, canvasH - h - margin);
        const x = margin + Math.random() * (maxX - margin > 0 ? maxX - margin : 0) + Math.random() * maxX * 0.4;
        const y = margin + Math.random() * (maxY - margin > 0 ? maxY - margin : 0) + Math.random() * maxY * 0.4;
        const rotation = Math.random() * 16 - 8;
        return {
          id: makeId(),
          src,
          x: Math.min(x, maxX),
          y: Math.min(y, maxY),
          width: w,
          height: h,
          rotation,
          naturalWidth,
          naturalHeight,
        };
      });
      const merged = [...prev, ...next];
      if (startCount === 0 && next.length) setSelectedId(next[next.length - 1].id);
      return merged;
    });
  }, [canvasW, canvasH]);

  function handleFileInputChange(e) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function toLogicalPoint(clientX, clientY) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }

  function beginDrag(e, id) {
    e.stopPropagation();
    const img = images.find((i) => i.id === id);
    if (!img) return;
    setSelectedId(id);
    setImages((prev) => {
      const others = prev.filter((i) => i.id !== id);
      return [...others, img];
    });
    const p = toLogicalPoint(e.clientX, e.clientY);
    interactionRef.current = { type: "drag", id, startX: p.x, startY: p.y, origX: img.x, origY: img.y };
  }

  function beginResize(e, id, corner) {
    e.stopPropagation();
    const img = images.find((i) => i.id === id);
    if (!img) return;
    setSelectedId(id);
    const signX = corner === "ne" || corner === "se" ? 1 : -1;
    const signY = corner === "sw" || corner === "se" ? 1 : -1;
    const center = { x: img.x + img.width / 2, y: img.y + img.height / 2 };
    const anchorLocal = { x: -signX * img.width / 2, y: -signY * img.height / 2 };
    const rotated = rotateVec(anchorLocal.x, anchorLocal.y, img.rotation);
    const anchorWorld = { x: center.x + rotated.x, y: center.y + rotated.y };
    interactionRef.current = {
      type: "resize",
      id,
      signX,
      signY,
      anchorWorld,
      origWidth: img.width,
      origHeight: img.height,
      rotation: img.rotation,
    };
  }

  function beginRotate(e, id) {
    e.stopPropagation();
    const img = images.find((i) => i.id === id);
    if (!img) return;
    setSelectedId(id);
    const center = { x: img.x + img.width / 2, y: img.y + img.height / 2 };
    interactionRef.current = { type: "rotate", id, center };
  }

  useEffect(() => {
    function onMove(e) {
      const it = interactionRef.current;
      if (!it) return;
      const p = toLogicalPoint(e.clientX, e.clientY);
      if (it.type === "drag") {
        updateImage(it.id, { x: it.origX + (p.x - it.startX), y: it.origY + (p.y - it.startY) });
      } else if (it.type === "resize") {
        const v = { x: p.x - it.anchorWorld.x, y: p.y - it.anchorWorld.y };
        const local = rotateVec(v.x, v.y, -it.rotation);
        const rawW = Math.abs(local.x), rawH = Math.abs(local.y);
        const factor = Math.max(0.04, (rawW / it.origWidth + rawH / it.origHeight) / 2);
        const newWidth = Math.max(24, it.origWidth * factor);
        const newHeight = Math.max(24, it.origHeight * factor);
        const centerOffsetLocal = { x: it.signX * newWidth / 2, y: it.signY * newHeight / 2 };
        const rotatedOffset = rotateVec(centerOffsetLocal.x, centerOffsetLocal.y, it.rotation);
        const newCenter = { x: it.anchorWorld.x + rotatedOffset.x, y: it.anchorWorld.y + rotatedOffset.y };
        updateImage(it.id, {
          x: newCenter.x - newWidth / 2,
          y: newCenter.y - newHeight / 2,
          width: newWidth,
          height: newHeight,
        });
      } else if (it.type === "rotate") {
        const angle = (Math.atan2(p.y - it.center.y, p.x - it.center.x) * 180) / Math.PI + 90;
        updateImage(it.id, { rotation: angle });
      }
    }
    function onUp() {
      interactionRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [scale, updateImage]);

  useEffect(() => {
    function onKey(e) {
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "SELECT")) return;
        setImages((prev) => prev.filter((i) => i.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function handleAutoFit() {
    if (!images.length) return;
    const laid = computeAutoFit(images, canvasW, canvasH, gap);
    const map = new Map(laid.map((l) => [l.id, l]));
    setImages((prev) => prev.map((im) => {
      const l = map.get(im.id);
      return l ? { ...im, x: l.x, y: l.y, width: l.width, height: l.height, rotation: 0 } : im;
    }));
  }

  function bringToFront(id) {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (!img) return prev;
      return [...prev.filter((i) => i.id !== id), img];
    });
  }
  function sendToBack(id) {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (!img) return prev;
      return [img, ...prev.filter((i) => i.id !== id)];
    });
  }
  function duplicateSelected() {
    if (!selectedId) return;
    const img = images.find((i) => i.id === selectedId);
    if (!img) return;
    const copy = { ...img, id: makeId(), x: img.x + 24, y: img.y + 24 };
    setImages((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }
  function deleteSelected() {
    if (!selectedId) return;
    setImages((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  }
  function clearAll() {
    setImages([]);
    setSelectedId(null);
  }

  function handleExport() {
    if (!images.length) return;
    const factor = 2;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvasW * factor;
    exportCanvas.height = canvasH * factor;
    const ctx = exportCanvas.getContext("2d");
    if (bg.value !== "transparent") {
      ctx.fillStyle = bg.value;
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }
    Promise.all(
      images.map(
        (im) =>
          new Promise((resolve) => {
            const el = new Image();
            el.onload = () => resolve({ im, el });
            el.src = im.src;
          })
      )
    ).then((loaded) => {
      loaded.forEach(({ im, el }) => {
        ctx.save();
        const cx = (im.x + im.width / 2) * factor;
        const cy = (im.y + im.height / 2) * factor;
        ctx.translate(cx, cy);
        ctx.rotate((im.rotation * Math.PI) / 180);
        ctx.drawImage(el, (-im.width * factor) / 2, (-im.height * factor) / 2, im.width * factor, im.height * factor);
        ctx.restore();
      });
      const url = exportCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "collage.png";
      a.click();
    });
  }

  const selected = images.find((i) => i.id === selectedId) || null;

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "#131316",
        color: "#F2F0EA",
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{FONT_STYLE}</style>

      {/* Toolbar */}
      <div
        style={{
          borderBottom: "1px solid #2B2C31",
          background: "#1C1D21",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 6 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              background: ACCENT,
              transform: "rotate(-8deg)",
              boxShadow: "3px 4px 0 rgba(0,0,0,0.35)",
            }}
          />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>
            Scatter
          </span>
        </div>

        <select
          value={preset.key}
          onChange={(e) => setPreset(CANVAS_PRESETS.find((p) => p.key === e.target.value))}
          style={{
            background: "#131316",
            color: "#F2F0EA",
            border: "1px solid #2B2C31",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {CANVAS_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label} ({p.w}×{p.h})
            </option>
          ))}
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {BG_OPTIONS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBg(b)}
              title={b.label}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                cursor: "pointer",
                border: bg.key === b.key ? `2px solid ${ACCENT}` : "1px solid #3A3B41",
                background:
                  b.key === "transparent"
                    ? "repeating-conic-gradient(#3A3B41 0% 25%, #24252A 0% 50%) 50% / 8px 8px"
                    : b.value,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8D8F93" }}>
          <span>Gap</span>
          <input
            type="range"
            min={0}
            max={40}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            style={{ width: 80, accentColor: ACCENT }}
          />
        </div>

        <button
          onClick={handleAutoFit}
          disabled={!images.length}
          style={btnStyle(images.length ? "#2A2B30" : "#202124", images.length ? "#F2F0EA" : "#5C5D62")}
        >
          <Sparkles size={15} /> Auto-fit
        </button>

        <div style={{ flex: 1 }} />

        {selected && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 6 }}>
            <button onClick={duplicateSelected} title="Duplicate" style={iconBtnStyle}>
              <Copy size={15} />
            </button>
            <button onClick={() => bringToFront(selected.id)} title="Bring to front" style={iconBtnStyle}>
              <ChevronsUp size={15} />
            </button>
            <button onClick={() => sendToBack(selected.id)} title="Send to back" style={iconBtnStyle}>
              <ChevronsDown size={15} />
            </button>
            <button onClick={deleteSelected} title="Delete" style={iconBtnStyle}>
              <Trash2 size={15} />
            </button>
          </div>
        )}

        {images.length > 0 && (
          <button onClick={clearAll} style={btnStyle("#202124", "#B7B8BD")}>
            Clear
          </button>
        )}

        <button onClick={() => fileInputRef.current?.click()} style={btnStyle(ACCENT, "#131316", true)}>
          <Upload size={15} /> Add photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />

        <button onClick={handleExport} disabled={!images.length} style={btnStyle("#2A2B30", images.length ? "#F2F0EA" : "#5C5D62")}>
          <Download size={15} /> Export
        </button>
      </div>

      {/* Canvas viewport */}
      <div
        ref={viewportRef}
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        <div
          ref={canvasRef}
          onPointerDown={(e) => { if (e.target === canvasRef.current) setSelectedId(null); }}
          style={{
            width: canvasW,
            height: canvasH,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            background:
              bg.key === "transparent"
                ? "repeating-conic-gradient(#26272C 0% 25%, #1C1D21 0% 50%) 50% / 24px 24px"
                : bg.value,
            position: "relative",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            overflow: "hidden",
            flexShrink: 0,
            outline: isDraggingOver ? `2px dashed ${ACCENT}` : "1px solid #2B2C31",
            outlineOffset: 2,
          }}
        >
          {images.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                pointerEvents: "none",
              }}
            >
              <div style={{ position: "relative", width: 140, height: 90 }}>
                <div style={placeholderCard(-10, 6, 14)} />
                <div style={placeholderCard(30, -4, -8)} />
                <div style={placeholderCard(70, 10, 5)} />
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#5C5D62", fontWeight: 600 }}>
                Drop photos here, or Add photos
              </div>
            </div>
          )}

          {images.map((im) => {
            const isSel = im.id === selectedId;
            return (
              <div
                key={im.id}
                onPointerDown={(e) => beginDrag(e, im.id)}
                style={{
                  position: "absolute",
                  left: im.x,
                  top: im.y,
                  width: im.width,
                  height: im.height,
                  transform: `rotate(${im.rotation}deg)`,
                  transformOrigin: "center center",
                  cursor: "grab",
                  touchAction: "none",
                }}
              >
                <img
                  src={im.src}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    boxShadow: isSel ? "none" : "0 6px 16px rgba(0,0,0,0.25)",
                    outline: isSel ? `2px dashed ${ACCENT}` : "none",
                    outlineOffset: 3,
                    userSelect: "none",
                  }}
                />
                {isSel && (
                  <>
                    {["nw", "ne", "sw", "se"].map((corner) => (
                      <div
                        key={corner}
                        onPointerDown={(e) => beginResize(e, im.id, corner)}
                        style={handleStyle(corner)}
                      />
                    ))}
                    <div
                      onPointerDown={(e) => beginRotate(e, im.id)}
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: -34,
                        width: 16,
                        height: 16,
                        marginLeft: -8,
                        borderRadius: "50%",
                        background: ACCENT,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "grab",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                      }}
                    >
                      <RotateCw size={9} color="#131316" />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: -34,
                        width: 1,
                        height: 34,
                        background: ACCENT,
                        opacity: 0.5,
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function placeholderCard(left, top, rot) {
  return {
    position: "absolute",
    left,
    top,
    width: 64,
    height: 78,
    background: "#202126",
    border: "1px solid #303136",
    borderRadius: 3,
    transform: `rotate(${rot}deg)`,
    boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
  };
}

function handleStyle(corner) {
  const size = 12;
  const base = {
    position: "absolute",
    width: size,
    height: size,
    background: ACCENT,
    borderRadius: 2,
    boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
  };
  if (corner === "nw") return { ...base, left: -size / 2, top: -size / 2, cursor: "nwse-resize", transform: "rotate(-6deg)" };
  if (corner === "ne") return { ...base, right: -size / 2, top: -size / 2, cursor: "nesw-resize", transform: "rotate(6deg)" };
  if (corner === "sw") return { ...base, left: -size / 2, bottom: -size / 2, cursor: "nesw-resize", transform: "rotate(6deg)" };
  return { ...base, right: -size / 2, bottom: -size / 2, cursor: "nwse-resize", transform: "rotate(-6deg)" };
}

function btnStyle(bg, color, solid) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: bg,
    color,
    border: solid ? "none" : "1px solid #2B2C31",
    borderRadius: 6,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
  };
}

const iconBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  background: "#2A2B30",
  color: "#F2F0EA",
  border: "1px solid #2B2C31",
  borderRadius: 6,
  cursor: "pointer",
};

ReactDOM.createRoot(document.getElementById("root")).render(<CollageMaker />);
