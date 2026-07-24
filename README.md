# Collage

A freeform photo collage maker. No template grids or borders by default, just drop your photos on a canvas and arrange them however you like.

## Features

- **Freeform by default.** Photos land on the canvas at a scattered position, size, and slight rotation. No fixed slots.
- **Drag, resize, rotate.** Click a photo to select it, drag from the body to move it, drag a corner dot to resize, drag the top dot to rotate. Shift-click to select several photos and move them together.
- **Fit to canvas.** Automatically arranges every photo into a seamless mosaic that fills the canvas edge to edge, with an optional spacing slider if you want gaps.
- **Scatter freely.** Re-randomizes the freeform layout if you want a fresh arrangement.
- **Canvas sizes.** Square, portrait, landscape, story, widescreen, or a custom pixel size.
- **Background.** Any solid color, or transparent (exports a PNG with alpha).
- **Export PNG** at the canvas's native resolution.
- Keyboard shortcuts: Delete/Backspace to remove, Ctrl/Cmd+D to duplicate, arrow keys to nudge (hold Shift to nudge faster), `[` and `]` to send back/bring forward, Escape to deselect. Hold Shift while rotating to snap to 15 degree increments.
- Drag-and-drop or paste images straight onto the canvas.

Everything runs client-side. Nothing is uploaded anywhere.

## Files

```
index.html    structure
style.css     styling
script.js     all app logic
```

## Run locally

Just open `index.html` in a browser, no build step needed. (Some browsers restrict `file://` pages slightly; if drag-and-drop or fonts misbehave, serve it locally instead: `python3 -m http.server` from this folder, then visit `http://localhost:8000`.)

## Deploy to GitHub Pages

1. Create a new GitHub repository and push these three files (`index.html`, `style.css`, `script.js`) to the root of the `main` branch.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Save. GitHub gives you a URL like `https://your-username.github.io/your-repo/` within a minute or two.

No further configuration is needed, the app has no dependencies beyond a Google Fonts link.
