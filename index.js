import { createCanvas, Image } from "@napi-rs/canvas";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import { Resvg } from "@resvg/resvg-js";
import mjAPI from "mathjax-node";

// ============ IMPORT PHYSICS & DRAWING UTILITIES ============
import * as physics from "./physics.js";
// ===========================================================

// CONFIG
const CONFIG = {
  fps: 30,
  duration: 100,
  width: 1920,
  height: 1080,
  worldW: 14.22,
  worldH: 8,
  bgColor: "#0e1020",
  ffmpegPreset: "fast",
};

CONFIG.totalFrames = CONFIG.fps * CONFIG.duration;

// PIXELS PER WORLD UNIT
const PX_PER_UNIT_X = CONFIG.width / CONFIG.worldW;
const PX_PER_UNIT_Y = CONFIG.height / CONFIG.worldH;
const PX_PER_UNIT = Math.min(PX_PER_UNIT_X, PX_PER_UNIT_Y);

// CANVAS SETUP
const canvas = createCanvas(CONFIG.width, CONFIG.height);
const ctx = canvas.getContext("2d");

// MATHJAX NODE CONFIG
mjAPI.config({
  MathJax: {
    SVG: { font: "STIX-Web", scale: 100 },
  },
});
mjAPI.start();

let mathCache = {};

// Render LaTeX to PNG once
async function renderMathToSVG(latex, color = "#fff", targetHeight = 28) {
  const cacheKey = `${latex}:${color}:${targetHeight}`;
  if (mathCache[cacheKey]) return mathCache[cacheKey];

  try {
    console.log(
      `🔍 Rendering "${latex.substring(
        0,
        30
      )}..." with targetHeight: ${targetHeight}`
    );

    const result = await new Promise((resolve, reject) => {
      mjAPI.typeset(
        {
          math: latex,
          format: "TeX",
          svg: true,
          ex: 8,
          display: false,
        },
        (data) => {
          if (data.errors) reject(new Error(data.errors[0]));
          else resolve(data);
        }
      );
    });

    let svgString = result.svg;

    // DEBUG: Extract the actual ex height from SVG
    const heightMatch = svgString.match(/height="([\d.]+)ex"/);
    const originalExHeight = heightMatch ? parseFloat(heightMatch[1]) : 2.5;

    console.log(`📏 Original SVG: ${originalExHeight}ex tall`);

    if (!svgString || svgString.length < 20) throw new Error("Empty SVG");

    svgString = svgString.replace(
      /currentColor|fill="#000000"|fill="#000"/g,
      color
    );
    svgString = svgString.replace(/ /g, " ");

    // 🔥 CRITICAL FIX: Convert targetHeight from pixels to ex for Resvg
    // Assuming 1ex ≈ 14px in your current setup (from your debug: 2.009ex → 12px)
    const pixelsPerEx = 12 / 2.009; // Calculate from your actual output
    const targetHeightEx = targetHeight / pixelsPerEx;

    console.log(
      `⚙️ Converting: ${targetHeight}px → ${targetHeightEx.toFixed(2)}ex`
    );
    console.log(
      `⚙️ Original is ${originalExHeight}ex, scaling factor: ${(
        targetHeightEx / originalExHeight
      ).toFixed(2)}x`
    );

    const resvg = new Resvg(svgString, {
      // Option A: Use zoom with calculated scale factor
      fitTo: {
        mode: "zoom",
        value: targetHeightEx / originalExHeight,
      },
      // OR Option B: Use width with ex-to-px conversion
      // fitTo: {
      //   mode: 'width',
      //   value: targetHeightEx * pixelsPerEx
      // }
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    console.log(`✅ Final PNG: ${pngData.width} × ${pngData.height}px`);
    console.log(`   Expected: ~${targetHeight}px tall`);

    const img = new Image();
    img.src = pngBuffer;

    const width = pngData.width;
    const height = pngData.height;

    mathCache[cacheKey] = {
      success: true,
      img,
      width,
      height,
      debug: {
        originalExHeight,
        targetHeight,
        actualHeight: height,
        scaleFactor: (targetHeightEx / originalExHeight).toFixed(2),
      },
    };
    return mathCache[cacheKey];
  } catch (err) {
    console.error(`❌ Math rendering error for "${latex}":`, err.message);
    mathCache[cacheKey] = { success: false };
    return mathCache[cacheKey];
  }
}

// COORDINATE CONVERSION
const wx = (x) => CONFIG.width / 2 + x * PX_PER_UNIT;
const wy = (y) => CONFIG.height / 2 - y * PX_PER_UNIT;

// FADE FUNCTIONS
const fadeLinear = (t, start, duration) =>
  duration <= 0
    ? t >= start
      ? 1
      : 0
    : Math.max(0, Math.min((t - start) / duration, 1));
function fadeOutLinear(t, start, duration) {
  if (t < start) return 1;
  if (t > start + duration) return 0;
  return 1 - (t - start) / duration;
}

// DRAW TEXT
const drawText = ({
  value,
  x,
  y,
  size,
  color = "#fff",
  alpha = 1,
  align = "center",
}) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${size}px 'Inter', 'Arial', sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, wx(x), wy(y));
  ctx.globalAlpha = 1;
};

// DRAW MATH IMAGE - SYNCHRONOUS
const drawMathImage = ({
  latex,
  x,
  y,
  color = "#fff",
  alpha = 1,
  targetHeight = 28,
}) => {
  const cacheKey = `${latex}:${color}:${targetHeight}`;
  const cached = mathCache[cacheKey];
  if (!cached || !cached.success || !cached.img) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  const drawX = Math.round(wx(x) - cached.width / 2);
  const drawY = Math.round(wy(y) - cached.height / 2);
  ctx.drawImage(cached.img, drawX, drawY);
  ctx.restore();
};

// LOAD SCENE
let sceneSpec;
try {
  sceneSpec = JSON.parse(fs.readFileSync("scene.json", "utf8"));
  console.log("✅ Loaded scene.json");
} catch (err) {
  console.error("❌ Error loading scene.json:", err.message);
  process.exit(1);
}

// RENDER FRAME
function renderFrame(t) {
  ctx.fillStyle = CONFIG.bgColor;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  if (!sceneSpec?.phases) return;

  for (const phase of sceneSpec.phases) {
    const [start, end] = phase.time;
    if (t < start || t > end) continue;

    const localT = t - start;
    const phaseDuration = end - start;

    const calcAlpha = (item) => {
      const fadeInStart = item.fadeIn?.start ?? 0;
      const fadeInDuration = item.fadeIn?.duration ?? 0.5;

      const fadeOutStart =
        item.fadeOut?.start ??
        Math.max(phaseDuration - 0.5, fadeInStart + fadeInDuration);
      const fadeOutDuration = item.fadeOut?.duration ?? 0.5;

      const aIn = fadeLinear(localT, fadeInStart, fadeInDuration);
      const aOut = fadeOutLinear(localT, fadeOutStart, fadeOutDuration);

      return Math.max(0, Math.min(aIn * aOut, 1));
    };

    // RENDER TEXT
    if (phase.text) {
      phase.text.forEach((tObj) =>
        drawText({ ...tObj, alpha: calcAlpha(tObj) })
      );
    }

    // RENDER MATH
    if (phase.math) {
      phase.math.forEach((mObj) =>
        drawMathImage({ ...mObj, alpha: calcAlpha(mObj) })
      );
    }

    // RENDER PHYSICS OBJECTS - Just call physics functions!
    if (phase.objects) {
      phase.objects.forEach((obj) => {
        const alpha = calcAlpha(obj);
        if (alpha <= 0) return;

        try {
          switch (obj.type) {
            /* ===================== KINEMATICS ===================== */
            case "projectile":
              physics.projectileMotion(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;
            case "coordinate_system":
              physics.coordinateSystem(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            case "deceleration":
              physics.deceleration(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            /* ===================== OSCILLATIONS ===================== */
            case "shm":
              physics.simpleHarmonicMotion(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            case "pendulum":
              physics.pendulum(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            case "spring-mass":
              physics.springMass(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            /* ===================== CIRCULAR / ROTATION ===================== */
            case "circular":
              physics.circularMotion(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            /* ===================== WAVES ===================== */
            case "wave":
              physics.waveMotion(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            /* ===================== ELECTRICITY ===================== */
            case "coulomb":
              physics.coulombForce(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            /* ===================== COLLISIONS ===================== */
            case "collision":
              physics.collision(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            /* ===================== MODERN PHYSICS ===================== */
            case "radioactive-decay":
              physics.radioactiveDecay(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            /* ===================== THERMODYNAMICS ===================== */
            case "ideal-gas":
              physics.idealGas(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                t: localT,
                alpha,
              });
              break;

            /* ===================== OPTICS ===================== */
            case "refraction":
              physics.refraction(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            case "lens":
              physics.lensFormula(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            /* ===================== NEW: FREE BODY DIAGRAM ===================== */
            case "fbd":
              physics.freeBodyDiagram(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            /* ===================== NEW: GRAVITATION ===================== */
            case "gravitation":
              physics.gravitationDiagram(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            /* ===================== OPTIONAL EXTENSIONS ===================== */
            case "vector":
              physics.vectorDiagram(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            case "graph":
              physics.graphPlot(ctx, wx, wy, PX_PER_UNIT, {
                ...obj.params,
                alpha,
              });
              break;

            default:
              console.warn(`⚠️ Unknown object type: ${obj.type}`);
          }
        } catch (err) {
          console.error(`❌ Error rendering ${obj.type}:`, err.message);
        }
      });
    }
  }
}

// FFMPEG RAW PIPE
const ffmpeg = spawn(ffmpegPath, [
  "-y",
  "-f",
  "rawvideo",
  "-pix_fmt",
  "rgba",
  "-s",
  `${CONFIG.width}x${CONFIG.height}`,
  "-r",
  String(CONFIG.fps),
  "-i",
  "-",
  "-c:v",
  "libx264",
  "-preset",
  CONFIG.ffmpegPreset,
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "output.mp4",
]);

ffmpeg.stderr.on("data", (data) => {
  const msg = data.toString();
  if (msg.includes("frame=") || msg.includes("time="))
    process.stderr.write(`\r${msg.trim()}`);
});

ffmpeg.on("close", (code) => {
  console.log(
    code === 0 ? "\n✅ Video rendered successfully!" : "\n❌ FFmpeg error"
  );
  if (code === 0) console.log("📹 Output: output.mp4");
});

// MAIN
(async () => {
  console.log(
    `🎬 Starting render: ${CONFIG.totalFrames} frames @ ${CONFIG.fps}fps`
  );
  console.log(`📐 Resolution: ${CONFIG.width}x${CONFIG.height}`);
  console.log(`⏱️ Duration: ${CONFIG.duration}s\n`);

  // Pre-render all math expressions
  const mathExpressions = new Map();
  if (sceneSpec?.phases) {
    sceneSpec.phases.forEach((phase) => {
      if (phase.math) {
        phase.math.forEach((m) => {
          const targetHeight = m.targetHeight || 28;
          const key = `${m.latex}:${m.color || "#fff"}:${targetHeight}`;
          if (!mathExpressions.has(key)) {
            mathExpressions.set(key, {
              latex: m.latex,
              color: m.color || "#fff",
              targetHeight,
            });
          }
        });
      }
    });
  }

  console.log(`📐 Pre-rendering ${mathExpressions.size} math expressions...\n`);
  await Promise.all(
    Array.from(mathExpressions.values()).map((m) =>
      renderMathToSVG(m.latex, m.color, m.targetHeight)
    )
  );
  console.log("✅ Math expressions cached\n");

  const startTime = Date.now();
  for (let i = 0; i < CONFIG.totalFrames; i++) {
    const t = (i / CONFIG.totalFrames) * CONFIG.duration;
    renderFrame(t);

    // Get raw RGBA buffer
    try {
      const imageData = ctx.getImageData(0, 0, CONFIG.width, CONFIG.height);
      if (!ffmpeg.stdin.write(Buffer.from(imageData.data))) {
        await new Promise((r) => ffmpeg.stdin.once("drain", r));
      }
    } catch (err) {
      console.error("Frame error at", i, ":", err.message);
      break;
    }

    if (i % 30 === 0 && i > 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const percent = ((i / CONFIG.totalFrames) * 100).toFixed(1);
      process.stdout.write(
        `⏳ Frame ${i}/${CONFIG.totalFrames} (${percent}%, ${elapsed}s)\r`
      );
    }
  }

  ffmpeg.stdin.end();
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Rendering complete in ${totalTime}s`);
  console.log(
    `⏱️ Processing speed: ${(CONFIG.totalFrames / totalTime).toFixed(1)} fps`
  );
})();
