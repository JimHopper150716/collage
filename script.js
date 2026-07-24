(() => {
  "use strict";

  /* =====================================================
     State
  ===================================================== */
  const SIZE_PRESETS = {
    square:    { w: 1600, h: 1600 },
    portrait:  { w: 1600, h: 2000 },
    landscape: { w: 1800, h: 1200 },
    story:     { w: 1080, h: 1920 },
    wide:      { w: 1920, h: 1080 },
  };

  const state = {
    canvasW: 1600,
    canvasH: 1600,
    bg: "#faf7f2",
    bgTransparent: false,
    spacing: 0,
    photos: [],        // { id, imgEl, x, y, w, h, rot, z }
    selectedIds: new Set(),
    nextId: 1,
    nextZ: 1,
    minZ: 0,
    scale: 1,          // on-screen scale factor (canvas px -> CSS px)
  };

  /* =====================================================
     DOM references
  ===================================================== */
  const el = {
    canvasArea: document.getElementById("canvasArea"),
    canvasScaler: document.getElementById("canvasScaler"),
    canvas: document.getElementById("canvas"),
    emptyState: document.getElementById("emptyState"),
    fileInput: document.getElementById("fileInput"),
    addPhotosBtn: document.getElementById("addPhotosBtn"),
    photoCounter: document.getElementById("photoCounter"),
    sizePreset: document.getElementById("sizePreset"),
    customSizeRow: document.getElementById("customSizeRow"),
    customW: document.getElementById("customW"),
    customH: document.getElementById("customH"),
    applyCustomSize: document.getElementById("applyCustomSize"),
    bgColor: document.getElementById("bgColor"),
    bgTransparent: document.getElementById("bgTransparent"),
    autoFitBtn: document.getElementById("autoFitBtn"),
    scatterBtn: document.getElementById("scatterBtn"),
    spacingRange: document.getElementById("spacingRange"),
    spacingVal: document.getElementById("spacingVal"),
    selectionSection: document.getElementById("selectionSection"),
    selCount: document.getElementById("selCount"),
    frontBtn: document.getElementById("frontBtn"),
    backBtn: document.getElementById("backBtn"),
    duplicateBtn: document.getElementById("duplicateBtn"),
    deleteBtn: document.getElementById("deleteBtn"),
    clearBtn: document.getElementById("clearBtn"),
    exportBtn: document.getElementById("exportBtn"),
    toast: document.getElementById("toast"),
  };

  const photoElements = new Map(); // id -> DOM node

  /* =====================================================
     Helpers
  ===================================================== */
  function uid(){ return "p" + (state.nextId++); }

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function rotateVec(x, y, rad){
    const c = Math.cos(rad), s = Math.sin(rad);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function showToast(msg){
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove("show"), 1800);
  }

  function updateCounter(){
    const n = state.photos.length;
    el.photoCounter.textContent = n === 1 ? "1 photo" : `${n} photos`;
    el.emptyState.style.display = n === 0 ? "flex" : "none";
  }

  /* =====================================================
     Canvas sizing / scale-to-fit
  ===================================================== */
  function applyCanvasSize(){
    el.canvas.style.width = state.canvasW + "px";
    el.canvas.style.height = state.canvasH + "px";
    updateFitScale();
  }

  function updateFitScale(){
    const pad = 48;
    const availW = el.canvasArea.clientWidth - pad;
    const availH = el.canvasArea.clientHeight - pad;
    const scale = Math.min(availW / state.canvasW, availH / state.canvasH, 1);
    state.scale = scale > 0 ? scale : 1;
    el.canvas.style.transform = `scale(${state.scale})`;
    el.canvasScaler.style.width = state.canvasW * state.scale + "px";
    el.canvasScaler.style.height = state.canvasH * state.scale + "px";
  }

  window.addEventListener("resize", updateFitScale);

  /* =====================================================
     Background
  ===================================================== */
  function applyBackground(){
    if (state.bgTransparent){
      el.canvas.classList.add("transparent-bg");
    } else {
      el.canvas.classList.remove("transparent-bg");
      el.canvas.style.background = state.bg;
    }
  }

  el.bgColor.addEventListener("input", () => {
    state.bg = el.bgColor.value;
    state.bgTransparent = false;
    el.bgTransparent.setAttribute("aria-pressed", "false");
    applyBackground();
  });

  el.bgTransparent.addEventListener("click", () => {
    state.bgTransparent = !state.bgTransparent;
    el.bgTransparent.setAttribute("aria-pressed", String(state.bgTransparent));
    applyBackground();
  });

  /* =====================================================
     Size presets
  ===================================================== */
  el.sizePreset.addEventListener("change", () => {
    const val = el.sizePreset.value;
    el.customSizeRow.hidden = val !== "custom";
    if (val === "custom") return;
    const preset = SIZE_PRESETS[val];
    resizeCanvas(preset.w, preset.h);
  });

  el.applyCustomSize.addEventListener("click", () => {
    const w = clamp(parseInt(el.customW.value, 10) || state.canvasW, 200, 4000);
    const h = clamp(parseInt(el.customH.value, 10) || state.canvasH, 200, 4000);
    resizeCanvas(w, h);
  });

  function resizeCanvas(newW, newH){
    const scaleX = newW / state.canvasW;
    const scaleY = newH / state.canvasH;
    const uniform = Math.min(scaleX, scaleY);
    state.photos.forEach(p => {
      p.x *= scaleX;
      p.y *= scaleY;
      p.w *= uniform;
      p.h *= uniform;
    });
    state.canvasW = newW;
    state.canvasH = newH;
    applyCanvasSize();
    state.photos.forEach(renderPhoto);
  }

  /* =====================================================
     Adding photos
  ===================================================== */
  el.addPhotosBtn.addEventListener("click", () => el.fileInput.click());
  el.emptyState.addEventListener("click", () => el.fileInput.click());
  el.fileInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    el.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach(evt => {
    el.canvasArea.addEventListener(evt, (e) => { e.preventDefault(); el.canvasArea.style.background = "#2c2b31"; });
  });
  ["dragleave", "drop"].forEach(evt => {
    el.canvasArea.addEventListener(evt, (e) => { e.preventDefault(); el.canvasArea.style.background = ""; });
  });
  el.canvasArea.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length){
      addFiles(e.dataTransfer.files);
    }
  });

  document.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const files = [];
    for (const item of items){
      if (item.type && item.type.startsWith("image/")){
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) addFiles(files);
  });

  function addFiles(fileList){
    const files = Array.from(fileList).filter(f => f.type.startsWith("image/"));
    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgEl = new Image();
        imgEl.onload = () => addPhotoFromImage(imgEl, i);
        imgEl.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function addPhotoFromImage(imgEl, indexHint){
    const nw = imgEl.naturalWidth || 800;
    const nh = imgEl.naturalHeight || 800;
    const targetLong = Math.min(state.canvasW, state.canvasH) * 0.42;
    const scale = targetLong / Math.max(nw, nh);
    const w = nw * scale;
    const h = nh * scale;

    // Scattered but roughly centered placement: average two random samples.
    const rx = () => (Math.random() + Math.random()) / 2;
    const x = clamp(rx() * (state.canvasW - w), 0, Math.max(0, state.canvasW - w));
    const y = clamp(rx() * (state.canvasH - h), 0, Math.max(0, state.canvasH - h));
    const rot = (Math.random() * 16 - 8);

    const photo = {
      id: uid(),
      imgEl,
      x, y, w, h,
      rot,
      z: state.nextZ++,
    };
    state.photos.push(photo);
    createPhotoElement(photo);
    renderPhoto(photo);
    selectOnly(photo.id);
    updateCounter();
  }

  /* =====================================================
     Photo DOM element + rendering
  ===================================================== */
  function createPhotoElement(photo){
    const div = document.createElement("div");
    div.className = "photo";
    div.dataset.id = photo.id;

    const img = document.createElement("img");
    img.src = photo.imgEl.src;
    img.draggable = false;
    div.appendChild(img);

    const rline = document.createElement("div");
    rline.className = "handle-rotate-line";
    div.appendChild(rline);

    const rotHandle = document.createElement("div");
    rotHandle.className = "handle-rotate";
    rotHandle.addEventListener("mousedown", (e) => startRotate(e, photo));
    div.appendChild(rotHandle);

    ["nw", "ne", "sw", "se"].forEach(corner => {
      const h = document.createElement("div");
      h.className = `handle-resize handle-${corner}`;
      h.addEventListener("mousedown", (e) => startResize(e, photo, corner));
      div.appendChild(h);
    });

    div.addEventListener("mousedown", (e) => {
      if (e.target !== div && e.target !== img) return; // let handles manage their own drag
      startMove(e, photo);
    });

    el.canvas.appendChild(div);
    photoElements.set(photo.id, div);
  }

  function renderPhoto(photo){
    const node = photoElements.get(photo.id);
    if (!node) return;
    node.style.left = photo.x + "px";
    node.style.top = photo.y + "px";
    node.style.width = photo.w + "px";
    node.style.height = photo.h + "px";
    node.style.transform = `rotate(${photo.rot}deg)`;
    node.style.zIndex = photo.z;
    node.classList.toggle("selected", state.selectedIds.has(photo.id));
    node.classList.toggle("solo", state.selectedIds.size === 1 && state.selectedIds.has(photo.id));
  }

  function renderAll(){ state.photos.forEach(renderPhoto); }

  /* =====================================================
     Selection
  ===================================================== */
  function selectOnly(id){
    state.selectedIds.clear();
    state.selectedIds.add(id);
    renderAll();
    updateSelectionUI();
  }

  function toggleSelect(id){
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    renderAll();
    updateSelectionUI();
  }

  function clearSelection(){
    state.selectedIds.clear();
    renderAll();
    updateSelectionUI();
  }

  function updateSelectionUI(){
    const n = state.selectedIds.size;
    el.selectionSection.hidden = n === 0;
    el.selCount.textContent = String(n);
  }

  el.canvas.addEventListener("mousedown", (e) => {
    if (e.target === el.canvas) clearSelection();
  });

  /* =====================================================
     Drag to move
  ===================================================== */
  function startMove(e, photo){
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey){
      toggleSelect(photo.id);
      if (!state.selectedIds.has(photo.id)) return; // was deselected, nothing to drag
    } else if (!state.selectedIds.has(photo.id)){
      selectOnly(photo.id);
    }

    const ids = Array.from(state.selectedIds);
    const startPositions = ids.map(id => {
      const p = state.photos.find(pp => pp.id === id);
      return { p, x0: p.x, y0: p.y };
    });
    const startX = e.clientX, startY = e.clientY;
    bringGroupForward(ids);

    function onMove(ev){
      const dx = (ev.clientX - startX) / state.scale;
      const dy = (ev.clientY - startY) / state.scale;
      startPositions.forEach(({ p, x0, y0 }) => {
        p.x = x0 + dx;
        p.y = y0 + dy;
        renderPhoto(p);
      });
    }
    function onUp(){
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function bringGroupForward(ids){
    ids.forEach(id => {
      const p = state.photos.find(pp => pp.id === id);
      p.z = state.nextZ++;
      renderPhoto(p);
    });
  }

  /* =====================================================
     Resize (corner handles, opposite-corner anchored, rotation-aware)
  ===================================================== */
  function startResize(e, photo, corner){
    e.preventDefault();
    e.stopPropagation();
    selectOnly(photo.id);

    const rad = photo.rot * Math.PI / 180;
    const w0 = photo.w, h0 = photo.h;
    const aspect = w0 / h0;
    const cx0 = photo.x + w0 / 2, cy0 = photo.y + h0 / 2;

    // Anchor corner is opposite the dragged one, in local (unrotated) space relative to center.
    const anchorLocal = {
      se: { x: -w0 / 2, y: -h0 / 2 },
      sw: { x:  w0 / 2, y: -h0 / 2 },
      ne: { x: -w0 / 2, y:  h0 / 2 },
      nw: { x:  w0 / 2, y:  h0 / 2 },
    }[corner];

    const anchorOffsetWorld = rotateVec(anchorLocal.x, anchorLocal.y, rad);
    const anchorWorld = { x: cx0 + anchorOffsetWorld.x, y: cy0 + anchorOffsetWorld.y };

    const canvasRect = el.canvas.getBoundingClientRect();

    function onMove(ev){
      const mouseCanvasX = (ev.clientX - canvasRect.left) / state.scale;
      const mouseCanvasY = (ev.clientY - canvasRect.top) / state.scale;

      const relWorld = { x: mouseCanvasX - anchorWorld.x, y: mouseCanvasY - anchorWorld.y };
      const local = rotateVec(relWorld.x, relWorld.y, -rad);

      let rawW, rawH;
      if (corner === "se"){ rawW = local.x;  rawH = local.y; }
      else if (corner === "sw"){ rawW = -local.x; rawH = local.y; }
      else if (corner === "ne"){ rawW = local.x;  rawH = -local.y; }
      else { rawW = -local.x; rawH = -local.y; } // nw

      let scaleFactor = ((rawW / w0) + (rawH / h0)) / 2;
      scaleFactor = clamp(scaleFactor, 0.04, 20);

      const newW = Math.max(16, w0 * scaleFactor);
      const newH = Math.max(16 / aspect, newW / aspect);

      const centerOffsetLocal = {
        se: { x:  newW / 2, y:  newH / 2 },
        sw: { x: -newW / 2, y:  newH / 2 },
        ne: { x:  newW / 2, y: -newH / 2 },
        nw: { x: -newW / 2, y: -newH / 2 },
      }[corner];
      const centerOffsetWorld = rotateVec(centerOffsetLocal.x, centerOffsetLocal.y, rad);
      const newCenter = { x: anchorWorld.x + centerOffsetWorld.x, y: anchorWorld.y + centerOffsetWorld.y };

      photo.w = newW;
      photo.h = newH;
      photo.x = newCenter.x - newW / 2;
      photo.y = newCenter.y - newH / 2;
      renderPhoto(photo);
    }
    function onUp(){
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /* =====================================================
     Rotate
  ===================================================== */
  function startRotate(e, photo){
    e.preventDefault();
    e.stopPropagation();
    selectOnly(photo.id);

    const canvasRect = el.canvas.getBoundingClientRect();

    function onMove(ev){
      const cx = photo.x + photo.w / 2;
      const cy = photo.y + photo.h / 2;
      const mouseCanvasX = (ev.clientX - canvasRect.left) / state.scale;
      const mouseCanvasY = (ev.clientY - canvasRect.top) / state.scale;
      const angle = Math.atan2(mouseCanvasY - cy, mouseCanvasX - cx) * 180 / Math.PI;
      let rot = angle + 90;
      if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
      photo.rot = rot;
      renderPhoto(photo);
    }
    function onUp(){
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /* =====================================================
     Selection actions: front / back / duplicate / delete
  ===================================================== */
  el.frontBtn.addEventListener("click", () => {
    state.selectedIds.forEach(id => {
      const p = state.photos.find(pp => pp.id === id);
      p.z = state.nextZ++;
    });
    renderAll();
  });

  el.backBtn.addEventListener("click", () => {
    state.selectedIds.forEach(id => {
      const p = state.photos.find(pp => pp.id === id);
      state.minZ--;
      p.z = state.minZ;
    });
    renderAll();
  });

  el.duplicateBtn.addEventListener("click", duplicateSelected);
  function duplicateSelected(){
    const ids = Array.from(state.selectedIds);
    if (!ids.length) return;
    const newIds = [];
    ids.forEach(id => {
      const src = state.photos.find(pp => pp.id === id);
      const dupImg = new Image();
      dupImg.src = src.imgEl.src;
      const dup = {
        id: uid(),
        imgEl: dupImg,
        x: src.x + 24, y: src.y + 24,
        w: src.w, h: src.h,
        rot: src.rot,
        z: state.nextZ++,
      };
      state.photos.push(dup);
      createPhotoElement(dup);
      renderPhoto(dup);
      newIds.push(dup.id);
    });
    state.selectedIds = new Set(newIds);
    renderAll();
    updateSelectionUI();
    updateCounter();
  }

  el.deleteBtn.addEventListener("click", deleteSelected);
  function deleteSelected(){
    if (!state.selectedIds.size) return;
    state.selectedIds.forEach(id => {
      const node = photoElements.get(id);
      if (node) node.remove();
      photoElements.delete(id);
    });
    state.photos = state.photos.filter(p => !state.selectedIds.has(p.id));
    state.selectedIds.clear();
    updateSelectionUI();
    updateCounter();
  }

  el.clearBtn.addEventListener("click", () => {
    if (!state.photos.length) return;
    if (!confirm("Clear all photos from the canvas?")) return;
    state.photos.forEach(p => {
      const node = photoElements.get(p.id);
      if (node) node.remove();
    });
    state.photos = [];
    photoElements.clear();
    state.selectedIds.clear();
    updateSelectionUI();
    updateCounter();
  });

  /* =====================================================
     Keyboard shortcuts
  ===================================================== */
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if ((e.key === "Delete" || e.key === "Backspace") && state.selectedIds.size){
      e.preventDefault();
      deleteSelected();
    } else if (e.key === "Escape"){
      clearSelection();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && state.selectedIds.size){
      e.preventDefault();
      duplicateSelected();
    } else if (e.key === "]" && state.selectedIds.size){
      el.frontBtn.click();
    } else if (e.key === "[" && state.selectedIds.size){
      el.backBtn.click();
    } else if (e.key.startsWith("Arrow") && state.selectedIds.size){
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      state.selectedIds.forEach(id => {
        const p = state.photos.find(pp => pp.id === id);
        p.x += dx; p.y += dy;
        renderPhoto(p);
      });
    }
  });

  /* =====================================================
     Scatter (re-randomize freeform layout)
  ===================================================== */
  el.scatterBtn.addEventListener("click", () => {
    if (!state.photos.length) return;
    const rx = () => (Math.random() + Math.random()) / 2;
    state.photos.forEach(p => {
      p.x = clamp(rx() * (state.canvasW - p.w), 0, Math.max(0, state.canvasW - p.w));
      p.y = clamp(rx() * (state.canvasH - p.h), 0, Math.max(0, state.canvasH - p.h));
      p.rot = Math.random() * 16 - 8;
      p.z = state.nextZ++;
    });
    renderAll();
  });

  /* =====================================================
     Spacing slider
  ===================================================== */
  el.spacingRange.addEventListener("input", () => {
    state.spacing = parseInt(el.spacingRange.value, 10);
    el.spacingVal.textContent = state.spacing + "px";
  });

  /* =====================================================
     Auto-fit: recursive rectangle mosaic that fills the
     whole canvas edge-to-edge with no gaps by default.
  ===================================================== */
  function bspSplit(rect, n){
    if (n <= 1) return [rect];
    const n1 = Math.ceil(n / 2);
    const n2 = n - n1;
    const horizontal = rect.w >= rect.h;
    const jitter = 0.86 + Math.random() * 0.28;
    let ratio = clamp((n1 / n) * jitter, 0.08, 0.92);

    if (horizontal){
      const w1 = rect.w * ratio;
      return [
        ...bspSplit({ x: rect.x, y: rect.y, w: w1, h: rect.h }, n1),
        ...bspSplit({ x: rect.x + w1, y: rect.y, w: rect.w - w1, h: rect.h }, n2),
      ];
    } else {
      const h1 = rect.h * ratio;
      return [
        ...bspSplit({ x: rect.x, y: rect.y, w: rect.w, h: h1 }, n1),
        ...bspSplit({ x: rect.x, y: rect.y + h1, w: rect.w, h: rect.h - h1 }, n2),
      ];
    }
  }

  el.autoFitBtn.addEventListener("click", () => {
    if (!state.photos.length){
      showToast("Add some photos first");
      return;
    }
    const rects = bspSplit({ x: 0, y: 0, w: state.canvasW, h: state.canvasH }, state.photos.length);
    const gap = state.spacing;
    state.photos.forEach((p, i) => {
      const r = rects[i];
      p.x = r.x + gap / 2;
      p.y = r.y + gap / 2;
      p.w = Math.max(8, r.w - gap);
      p.h = Math.max(8, r.h - gap);
      p.rot = 0;
    });
    renderAll();
    showToast("Fitted to canvas");
  });

  /* =====================================================
     Export
  ===================================================== */
  function drawCover(ctx, img, w, h){
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;
    const imgRatio = iw / ih, boxRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > boxRatio){
      sh = ih; sw = ih * boxRatio; sx = (iw - sw) / 2; sy = 0;
    } else {
      sw = iw; sh = iw / boxRatio; sx = 0; sy = (ih - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  }

  el.exportBtn.addEventListener("click", () => {
    if (!state.photos.length){
      showToast("Add some photos first");
      return;
    }
    const out = document.createElement("canvas");
    out.width = state.canvasW;
    out.height = state.canvasH;
    const ctx = out.getContext("2d");

    if (!state.bgTransparent){
      ctx.fillStyle = state.bg;
      ctx.fillRect(0, 0, out.width, out.height);
    }

    const sorted = [...state.photos].sort((a, b) => a.z - b.z);
    sorted.forEach(p => {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 12;
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot * Math.PI / 180);
      drawCover(ctx, p.imgEl, p.w, p.h);
      ctx.restore();
    });

    out.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "collage.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Exported collage.png");
    }, "image/png");
  });

  /* =====================================================
     Init
  ===================================================== */
  applyCanvasSize();
  applyBackground();
  updateCounter();
  updateSelectionUI();
})();
