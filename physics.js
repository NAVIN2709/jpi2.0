// physics.js
// Physics calculations + rendering all in one place

// Helper to draw circle
const drawCircle = (ctx, wx, wy, { x, y, radius, color = "#fff", fill = true, lineWidth = 2 }) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(wx(x), wy(y), radius, 0, 2 * Math.PI);
  fill ? ctx.fill() : ctx.stroke();
  ctx.restore();
};

// Helper function to draw arrowhead
function drawArrowhead(ctx, fromX, fromY, toX, toY, color, size) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(toX, toY);
  ctx.rotate(angle);
  
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size/2);
  ctx.lineTo(-size, size/2);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// Helper function to draw a point
function drawPoint(ctx, x, y, color, size) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  
  // Add glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Helper to draw line
const drawLine = (ctx, wx, wy, { x1, y1, x2, y2, color = "#fff", lineWidth = 2 }) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(wx(x1), wy(y1));
  ctx.lineTo(wx(x2), wy(y2));
  ctx.stroke();
  ctx.restore();
};

// Helper to draw rectangle
const drawRectangle = (ctx, wx, wy, PX_PER_UNIT, { x, y, width, height, color = "#fff", fill = true, lineWidth = 2 }) => {
  ctx.save();
  ctx.translate(wx(x), wy(y));
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  
  const w = width * PX_PER_UNIT;
  const h = height * PX_PER_UNIT;
  fill ? ctx.fillRect(-w / 2, -h / 2, w, h) : ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
};

// Helper to draw arrow (for forces, vectors)
const drawArrow = (
  ctx, wx, wy, PX_PER_UNIT,
  { x1, y1, x2, y2, color = "#fff", lineWidth = 2, headLength = 12 }
) => {
  const sx1 = wx(x1);
  const sy1 = wy(y1);
  const sx2 = wx(x2);
  const sy2 = wy(y2);

  const angle = Math.atan2(sy2 - sy1, sx2 - sx1);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;

  // Main line
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(sx2, sy2);
  ctx.lineTo(
    sx2 - headLength * Math.cos(angle - Math.PI / 6),
    sy2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    sx2 - headLength * Math.cos(angle + Math.PI / 6),
    sy2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};



// ============================================
// PROJECTILE MOTION - WITH RENDERING
// ============================================
export const projectileMotion = (ctx, wx, wy, PX_PER_UNIT, { x0, y0, v0, angle, g = 10, t, color = "#ff6b6b", alpha = 1 }) => {
  const radians = (angle * Math.PI) / 180;
  const vx = v0 * Math.cos(radians);
  const vy = v0 * Math.sin(radians);
  
  const x = x0 + vx * t;
  const y = y0 + vy * t - 0.5 * g * t * t;
  
  // RENDER
  ctx.globalAlpha = alpha;
  drawCircle(ctx, wx, wy, { x, y, radius: 8, color, fill: true });
  ctx.globalAlpha = 1;
  
  return { x, y, vx, vy };
};

// ============================================
// CIRCULAR MOTION - WITH RENDERING
// ============================================
export const circularMotion = (ctx, wx, wy, PX_PER_UNIT, { cx, cy, radius, omega, t, phase = 0, drawRadius = true, alpha = 1 }) => {
  const theta = omega * t + phase;
  const x = cx + radius * Math.cos(theta);
  const y = cy + radius * Math.sin(theta);
  const vMag = radius * omega;
  
  // RENDER
  ctx.globalAlpha = alpha;
  
  // Draw orbit circle
  drawCircle(ctx, wx, wy, { x: cx, y: cy, radius: radius * PX_PER_UNIT, color: "#555", fill: false, lineWidth: 2 });
  
  // Draw radius line if enabled
  if (drawRadius) {
    drawLine(ctx, wx, wy, { x1: cx, y1: cy, x2: x, y2: y, color: "#888", lineWidth: 1 });
  }
  
  // Draw moving object
  drawCircle(ctx, wx, wy, { x, y, radius: 8, color: "#a8edea", fill: true });
  
  ctx.globalAlpha = 1;
  
  return { x, y, theta, vMag };
};

// ============================================
// SIMPLE HARMONIC MOTION - WITH RENDERING
// ============================================
export const simpleHarmonicMotion = (ctx, wx, wy, PX_PER_UNIT, { x0, amplitude, omega, t, phase = 0, alpha = 1 }) => {
  const x = x0 + amplitude * Math.cos(omega * t + phase);
  const v = -amplitude * omega * Math.sin(omega * t + phase);
  const a = -amplitude * omega * omega * Math.cos(omega * t + phase);
  
  // RENDER
  ctx.globalAlpha = alpha;
  drawCircle(ctx, wx, wy, { x, y: 0, radius: 8, color: "#4ecdc4", fill: true });
  ctx.globalAlpha = 1;
  
  return { x, v, a };
};

// ============================================
// PENDULUM - WITH RENDERING
// ============================================
export const pendulum = (ctx, wx, wy, PX_PER_UNIT, { x0, y0, length, maxAngle, omega, t, phase = 0, alpha = 1 }) => {
  const theta = maxAngle * Math.sin(omega * t + phase);
  const x = x0 + length * Math.sin(theta);
  const y = y0 - length * Math.cos(theta);
  
  // RENDER
  ctx.globalAlpha = alpha;
  
  // Draw string
  drawLine(ctx, wx, wy, { x1: x0, y1: y0, x2: x, y2: y, color: "#ffd93d", lineWidth: 2 });
  
  // Draw bob (mass at end)
  drawCircle(ctx, wx, wy, { x, y, radius: 10, color: "#ffd93d", fill: true });
  
  ctx.globalAlpha = 1;
  
  return { x, y, theta };
};

// ============================================
// SPRING-MASS SYSTEM - WITH RENDERING
// ============================================
export const springMass = (ctx, wx, wy, PX_PER_UNIT, { x0, k, m, amplitude, t, phase = 0, alpha = 1 }) => {
  const omega = Math.sqrt(k / m);
  const x = x0 + amplitude * Math.cos(omega * t + phase);
  const v = -amplitude * omega * Math.sin(omega * t + phase);
  const F = -k * (x - x0);
  
  // RENDER
  ctx.globalAlpha = alpha;
  drawRectangle(ctx, wx, wy, PX_PER_UNIT, { x, y: 0, width: 0.5, height: 0.5, color: "#ff6b6b", fill: true });
  ctx.globalAlpha = 1;
  
  return { x, v, F };
};

// ============================================
// WAVE MOTION - WITH RENDERING
// ============================================
export const waveMotion = (ctx, wx, wy, PX_PER_UNIT, { amplitude, wavelength, frequency, xStart, xEnd, t, alpha = 1 }) => {
  const k = (2 * Math.PI) / wavelength;
  const omega = 2 * Math.PI * frequency;
  
  // Calculate points for the wave
  const points = [];
  const step = 0.15;
  
  for (let x = xStart; x <= xEnd; x += step) {
    const y = amplitude * Math.sin(k * x - omega * t);
    points.push({ x, y });
  }
  
  // RENDER - Draw wave as connected lines
  ctx.globalAlpha = alpha;
  for (let i = 0; i < points.length - 1; i++) {
    drawLine(ctx, wx, wy, {
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y,
      color: "#5f9ea0",
      lineWidth: 3
    });
  }
  ctx.globalAlpha = 1;
  
  return { points };
};

// ============================================
// DECELERATION (FRICTION) - WITH RENDERING
// ============================================
export const deceleration = (ctx, wx, wy, PX_PER_UNIT, { x0, v0, a, t, maxDist = Infinity, alpha = 1 }) => {
  const x = Math.min(x0 + v0 * t + 0.5 * a * t * t, x0 + maxDist);
  const v = v0 + a * t;
  const stopped = v <= 0;
  
  // RENDER
  ctx.globalAlpha = alpha;
  drawRectangle(ctx, wx, wy, PX_PER_UNIT, { x, y: 0, width: 0.6, height: 0.6, color: "#ff6b6b", fill: true });
  ctx.globalAlpha = 1;
  
  return { x, v, stopped };
};

// ============================================
// COLLISION (TWO OBJECTS) - WITH RENDERING
// ============================================
export const collision = (ctx, wx, wy, PX_PER_UNIT, { q1, q2, r, alpha = 1 }) => {
  // RENDER - Static representation showing two approaching spheres
  ctx.globalAlpha = alpha;
  
  // First object (red, left)
  drawCircle(ctx, wx, wy, { x: -2, y: 0, radius: 12, color: "#ff0000", fill: true });
  
  // Second object (blue, right)
  drawCircle(ctx, wx, wy, { x: 2, y: 0, radius: 10, color: "#0000ff", fill: true });
  
  ctx.globalAlpha = 1;
  
  return { q1, q2, r };
};

// ============================================
// DOPPLER EFFECT - RENDERING
// ============================================
export const dopplerEffect = (ctx, wx, wy, PX_PER_UNIT, { f0, vSource, vObserver, vSound = 340, alpha = 1 }) => {
  const f = f0 * ((vSound + vObserver) / (vSound - vSource));
  const wavelength = vSound / f;
  
  // RENDER - Just show frequencies
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffff00";
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`f_observed = ${f.toFixed(1)} Hz`, wx(0), wy(0));
  ctx.globalAlpha = 1;
  
  return { frequency: f, wavelength };
};

// ============================================
// COULOMB FORCE - RENDERING
// ============================================
export const coulombForce = (ctx, wx, wy, PX_PER_UNIT, { q1, q2, r, k = 9e9, alpha = 1 }) => {
  const F = k * Math.abs(q1 * q2) / (r * r);
  
  // RENDER - Show two charges
  ctx.globalAlpha = alpha;
  drawCircle(ctx, wx, wy, { x: -2, y: 0, radius: 12, color: "#ff0000", fill: true });
  drawCircle(ctx, wx, wy, { x: 2, y: 0, radius: 10, color: "#0000ff", fill: true });
  ctx.globalAlpha = 1;
  
  return { force: F };
};

// ============================================
// ELECTRIC POTENTIAL - RENDERING
// ============================================
export const electricPotential = (ctx, wx, wy, PX_PER_UNIT, { q, r, k = 9e9, alpha = 1 }) => {
  const V = k * q / r;
  
  // RENDER
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffff00";
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`V = ${V.toFixed(1)} V`, wx(0), wy(0));
  ctx.globalAlpha = 1;
  
  return { potential: V };
};

// ============================================
// MAGNETIC FORCE - RENDERING
// ============================================
export const magneticForce = (ctx, wx, wy, PX_PER_UNIT, { q, v, B, angle = 90, alpha = 1 }) => {
  const radians = (angle * Math.PI) / 180;
  const F = q * v * B * Math.sin(radians);
  
  // RENDER - Show charged particle
  ctx.globalAlpha = alpha;
  drawCircle(ctx, wx, wy, { x: 0, y: 0, radius: 8, color: "#00ff00", fill: true });
  ctx.globalAlpha = 1;
  
  return { force: F };
};

// ============================================
// RADIOACTIVE DECAY - RENDERING
// ============================================
export const radioactiveDecay = (ctx, wx, wy, PX_PER_UNIT, { N0, lambda, t, alpha = 1 }) => {
  const N = N0 * Math.exp(-lambda * t);
  const activity = lambda * N;
  
  // RENDER - Show decay progress
  const percentage = (N / N0) * 100;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#00ff00";
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Nuclei: ${N.toFixed(0)} (${percentage.toFixed(1)}%)`, wx(0), wy(0));
  ctx.globalAlpha = 1;
  
  return { nuclei: N, activity };
};

// ============================================
// IDEAL GAS LAW - RENDERING
// ============================================
export const idealGas = (ctx, wx, wy, PX_PER_UNIT, { P0, V0, T0, T, alpha = 1 }) => {
  const P = P0 * (T / T0);
  const V = V0 * (T / T0);
  
  // RENDER - Show temperature change
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ff6b6b";
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`P = ${P.toFixed(2)} Pa, V = ${V.toFixed(2)} m³`, wx(0), wy(0));
  ctx.globalAlpha = 1;
  
  return { P, V };
};

// ============================================
// REFRACTION (SNELL'S LAW) - RENDERING
// ============================================
export const refraction = (ctx, wx, wy, PX_PER_UNIT, { angle1, n1, n2, alpha = 1 }) => {
  const sinAngle2 = (n1 / n2) * Math.sin((angle1 * Math.PI) / 180);
  const angle2 = (Math.asin(sinAngle2) * 180) / Math.PI;
  
  // RENDER - Show light bending
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ffff00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wx(-2), wy(2));
  ctx.lineTo(wx(0), wy(0));
  ctx.lineTo(wx(2), wy(-2));
  ctx.stroke();
  ctx.globalAlpha = 1;
  
  return { incidentAngle: angle1, refractedAngle: angle2 };
};

// ============================================
// LENS FORMULA - RENDERING
// ============================================
export const lensFormula = (ctx, wx, wy, PX_PER_UNIT, { f, u, alpha = 1 }) => {
  const v = (f * u) / (u - f);
  const m = -v / u;
  
  // RENDER - Show lens with object and image
  ctx.globalAlpha = alpha;
  drawLine(ctx, wx, wy, { x1: 0, y1: -3, x2: 0, y2: 3, color: "#00ffff", lineWidth: 3 });
  drawCircle(ctx, wx, wy, { x: u, y: 0, radius: 6, color: "#ff0000", fill: true }); // Object
  drawCircle(ctx, wx, wy, { x: v, y: 0, radius: 6, color: "#00ff00", fill: true }); // Image
  ctx.globalAlpha = 1;
  
  return { imageDistance: v, magnification: m, isReal: v > 0 };
};

// ============================================
// INCLINED PLANE
// ============================================
export const inclinedPlane = (ctx, wx, wy, PX_PER_UNIT, {
  angle = 30,
  mu = 0,
  alpha = 1
}) => {
  const rad = angle * Math.PI / 180;

  ctx.globalAlpha = alpha;

  // Draw incline
  drawLine(ctx, wx, wy, {
    x1: -5, y1: -2,
    x2: 5, y2: -2 + Math.tan(rad) * 10,
    color: "#888",
    lineWidth: 4
  });

  // Block position
  const x = 0;
  const y = -2 + Math.tan(rad) * (x + 5);

  // Draw block
  drawRectangle(ctx, wx, wy, PX_PER_UNIT, {
    x, y,
    width: 0.8,
    height: 0.8,
    color: "#ff6b6b",
    fill: true
  });

  // Weight
  drawArrow(ctx, wx, wy, PX_PER_UNIT, {
    x1: x, y1: y,
    x2: x, y2: y - 2,
    color: "#ff0000"
  });

  // Normal
  drawArrow(ctx, wx, wy, PX_PER_UNIT, {
    x1: x, y1: y,
    x2: x - Math.sin(rad), y2: y + Math.cos(rad),
    color: "#00ff00"
  });

  // Friction
  if (mu > 0) {
    drawArrow(ctx, wx, wy, PX_PER_UNIT, {
      x1: x, y1: y,
      x2: x - Math.cos(rad), y2: y - Math.sin(rad),
      color: "#ffff00"
    });
  }

  ctx.globalAlpha = 1;
  return {};
};

// ============================================
// MOTION GRAPH
// ============================================
export const motionGraph = (ctx, wx, wy, PX_PER_UNIT, {
  fn,        // function(t)
  tMax = 10,
  type = "vt", // "xt", "vt", "at"
  alpha = 1
}) => {
  ctx.globalAlpha = alpha;

  // Axes
  drawLine(ctx, wx, wy, { x1: -5, y1: 0, x2: 5, y2: 0, color: "#888" });
  drawLine(ctx, wx, wy, { x1: 0, y1: -3, x2: 0, y2: 3, color: "#888" });

  ctx.strokeStyle = "#4ecdc4";
  ctx.lineWidth = 3;
  ctx.beginPath();

  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * tMax;
    const v = fn(t);
    const x = (t / tMax) * 8 - 4;
    const y = v;

    if (i === 0) ctx.moveTo(wx(x), wy(y));
    else ctx.lineTo(wx(x), wy(y));
  }
  ctx.stroke();

  ctx.globalAlpha = 1;
  return {};
};

// ============================================
// ELECTRIC FIELD LINES
// ============================================
export const electricFieldLines = (ctx, wx, wy, PX_PER_UNIT, {
  charges = [],
  alpha = 1
}) => {
  ctx.globalAlpha = alpha;

  charges.forEach(c => {
    drawCircle(ctx, wx, wy, {
      x: c.x,
      y: c.y,
      radius: 14,
      color: c.q > 0 ? "#ff0000" : "#0000ff",
      fill: true
    });

    for (let a = 0; a < 2 * Math.PI; a += Math.PI / 8) {
      const dx = Math.cos(a);
      const dy = Math.sin(a);

      drawArrow(ctx, wx, wy, PX_PER_UNIT, {
        x1: c.x,
        y1: c.y,
        x2: c.x + dx * (c.q > 0 ? 1.5 : -1.5),
        y2: c.y + dy * (c.q > 0 ? 1.5 : -1.5),
        color: "#ffff00",
        lineWidth: 2,
        headSize: 0.1
      });
    }
  });

  ctx.globalAlpha = 1;
  return {};
};

// ============================================
// FREE BODY DIAGRAM (FBD)
// ============================================
export const freeBodyDiagram = (ctx, wx, wy, PX_PER_UNIT, {
  x = 0,
  y = 0,
  forces = [],   // [{ fx, fy, label, color }]
  alpha = 1
}) => {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Draw block
  drawRectangle(ctx, wx, wy, PX_PER_UNIT, {
    x,
    y,
    width: 0.8,
    height: 0.8,
    color: "#4ecdc4",
    fill: true
  });

  const FORCE_SCALE = 0.9; // 🔥 visual scaling (IMPORTANT)

  forces.forEach(f => {
    const dx = f.fx * FORCE_SCALE;
    const dy = f.fy * FORCE_SCALE;

    // Draw force arrow
    drawArrow(ctx, wx, wy, PX_PER_UNIT, {
      x1: x,
      y1: y,
      x2: x + dx,
      y2: y + dy,
      color: f.color || "#ffcc00",
      lineWidth: 3,
      headLength: 14
    });

    // Draw label
    if (f.label) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        f.label,
        wx(x + dx * 1.15),
        wy(y + dy * 1.15)
      );
    }
  });

  ctx.restore();
};


// ============================================
// GRAVITATION FORCE DIAGRAM
// ============================================
export const gravitationDiagram = (ctx, wx, wy, PX_PER_UNIT, {
  body1 = { x: -2, y: 0, m: 5, label: "m₁", color: "#ff6b6b" },
  body2 = { x:  2, y: 0, m: 10, label: "m₂", color: "#4ecdc4" },
  showLine = true,
  showForces = true,
  showDistance = true,
  alpha = 1
}) => {
  ctx.globalAlpha = alpha;

  /* ---------- draw masses ---------- */
  const drawMass = (b) => {
    ctx.beginPath();
    ctx.fillStyle = b.color;
    ctx.arc(wx(b.x), wy(b.y), PX_PER_UNIT * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "18px Arial";
    ctx.fillText(b.label, wx(b.x) - 10, wy(b.y) - 15);
  };

  drawMass(body1);
  drawMass(body2);

  /* ---------- center joining line ---------- */
  if (showLine) {
    ctx.strokeStyle = "#888";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(wx(body1.x), wy(body1.y));
    ctx.lineTo(wx(body2.x), wy(body2.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------- gravitational force vectors ---------- */
  if (showForces) {
    const dx = body2.x - body1.x;
    const dy = body2.y - body1.y;
    const r = Math.hypot(dx, dy);

    const ux = dx / r;
    const uy = dy / r;

    const forceScale = 1.2;

    // Force on body1
    drawArrow(ctx, wx, wy, PX_PER_UNIT, {
      x1: body1.x,
      y1: body1.y,
      x2: body1.x + ux * forceScale,
      y2: body1.y + uy * forceScale,
      color: "#ffd700",
      lineWidth: 3
    });

    // Force on body2
    drawArrow(ctx, wx, wy, PX_PER_UNIT, {
      x1: body2.x,
      y1: body2.y,
      x2: body2.x - ux * forceScale,
      y2: body2.y - uy * forceScale,
      color: "#ffd700",
      lineWidth: 3
    });

    ctx.fillStyle = "#ffd700";
    ctx.font = "16px Arial";
    ctx.fillText("F", wx(body1.x + ux * 1.3), wy(body1.y + uy * 1.3));
    ctx.fillText("F", wx(body2.x - ux * 1.3), wy(body2.y - uy * 1.3));
  }

  /* ---------- distance label ---------- */
  if (showDistance) {
    const mx = (body1.x + body2.x) / 2;
    const my = (body1.y + body2.y) / 2;

    ctx.fillStyle = "#aaa";
    ctx.font = "16px Arial";
    ctx.fillText("r", wx(mx), wy(my) - 8);
  }

  ctx.globalAlpha = 1;
  return {};
};

// ============================================
// COORDINATE SYSTEM - USES wx, wy, PX_PER_UNIT
// ============================================
// ============================================
// COORDINATE SYSTEM - PROPER BOX-RELATIVE RENDERING
// ============================================
export const coordinateSystem = (ctx, wx, wy, PX_PER_UNIT, params = {}) => {
  const {
    points = [],
    force = null,
    boxWidth = 600,
    boxHeight = 600,
    boxX = 60,
    boxY = 100,
    alpha = 1,
    showGrid = true,
    showAxes = true,
    showLabels = true
  } = params;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Draw bounding box
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  // Collect all points for bounds
  const allPoints = [...points];
  if (force?.origin) {
    allPoints.push({ x: force.origin[0], y: force.origin[1] });
  }
  if (force?.components) {
    allPoints.push({
      x: force.origin[0] + force.components[0],
      y: force.origin[1] + force.components[1]
    });
  }

  if (allPoints.length === 0) {
    ctx.restore();
    return;
  }

  // Find world bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  allPoints.forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  // Add padding
  const boundsPadding = 1;
  minX -= boundsPadding;
  maxX += boundsPadding;
  minY -= boundsPadding;
  maxY += boundsPadding;

  const xRange = Math.max(maxX - minX, 0.1);
  const yRange = Math.max(maxY - minY, 0.1);

  // 🔥 SCALE TO FIT IN BOX (NOT using PX_PER_UNIT for box - this is local scaling)
  const scaleX = (boxWidth * 0.9) / xRange;
  const scaleY = (boxHeight * 0.9) / yRange;
  const localScale = Math.min(scaleX, scaleY);

  const boxCenterX = boxX + boxWidth / 2;
  const boxCenterY = boxY + boxHeight / 2;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // LOCAL BOX CONVERSION - scales to fit content in box
  const toBoxPixelX = (worldX) => boxCenterX + (worldX - midX) * localScale;
  const toBoxPixelY = (worldY) => boxCenterY - (worldY - midY) * localScale; // Invert Y

  // ============ GRID ============
  if (showGrid) {
    ctx.strokeStyle = "rgba(120, 120, 120, 0.6)";
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let i = Math.ceil(minX); i <= Math.floor(maxX); i++) {
      const x = toBoxPixelX(i);
      ctx.beginPath();
      ctx.moveTo(x, boxY);
      ctx.lineTo(x, boxY + boxHeight);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = Math.ceil(minY); i <= Math.floor(maxY); i++) {
      const y = toBoxPixelY(i);
      ctx.beginPath();
      ctx.moveTo(boxX, y);
      ctx.lineTo(boxX + boxWidth, y);
      ctx.stroke();
    }
  }

  // ============ AXES ============
  if (showAxes) {
    const axisPixelX = toBoxPixelX(0);
    const axisPixelY = toBoxPixelY(0);

    // X-axis
    if (axisPixelY >= boxY && axisPixelY <= boxY + boxHeight) {
      ctx.strokeStyle = "#666666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boxX, axisPixelY);
      ctx.lineTo(boxX + boxWidth, axisPixelY);
      ctx.stroke();

      // X-axis labels
      if (showLabels) {
        ctx.fillStyle = "#888888";
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        for (let i = Math.ceil(minX); i <= Math.floor(maxX); i++) {
          const x = toBoxPixelX(i);
          if (x > boxX + 5 && x < boxX + boxWidth - 5) {
            ctx.beginPath();
            ctx.moveTo(x, axisPixelY - 4);
            ctx.lineTo(x, axisPixelY + 4);
            ctx.stroke();
            ctx.fillText(i.toString(), x, axisPixelY + 8);
          }
        }
      }
    }

    // Y-axis
    if (axisPixelX >= boxX && axisPixelX <= boxX + boxWidth) {
      ctx.strokeStyle = "#666666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(axisPixelX, boxY);
      ctx.lineTo(axisPixelX, boxY + boxHeight);
      ctx.stroke();

      // Y-axis labels
      if (showLabels) {
        ctx.fillStyle = "#888888";
        ctx.font = "14px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        for (let i = Math.ceil(minY); i <= Math.floor(maxY); i++) {
          const y = toBoxPixelY(i);
          if (y > boxY + 5 && y < boxY + boxHeight - 5) {
            ctx.beginPath();
            ctx.moveTo(axisPixelX - 4, y);
            ctx.lineTo(axisPixelX + 4, y);
            ctx.stroke();
            ctx.fillText(i.toString(), axisPixelX - 10, y);
          }
        }
      }
    }
  }

  // ============ DISPLACEMENT VECTOR (P→Q) ============
  if (points.length >= 2) {
    const p1 = points[0];
    const p2 = points[1];
    const x1 = toBoxPixelX(p1.x);
    const y1 = toBoxPixelY(p1.y);
    const x2 = toBoxPixelX(p2.x);
    const y2 = toBoxPixelY(p2.y);

    // Draw line
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowSize = 12;
    ctx.fillStyle = "#ffd166";
    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowSize, -arrowSize / 2);
    ctx.lineTo(-arrowSize, arrowSize / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ============ FORCE VECTOR ============
  if (force?.origin && force?.components) {
    const [ox, oy] = force.origin;
    const [fx, fy] = force.components;
    const forceColor = force.color || "#45b7d1";

    const x1 = toBoxPixelX(ox);
    const y1 = toBoxPixelY(oy);
    const x2 = toBoxPixelX(ox + fx);
    const y2 = toBoxPixelY(oy + fy);

    // Draw line
    ctx.strokeStyle = forceColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowSize = 12;
    ctx.fillStyle = forceColor;
    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowSize, -arrowSize / 2);
    ctx.lineTo(-arrowSize, arrowSize / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ============ POINTS ============
  points.forEach(point => {
    const { x, y, label = "", color = "#ffffff" } = point;
    const px = toBoxPixelX(x);
    const py = toBoxPixelY(y);

    // Draw point circle (filled)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw point outline
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Draw label
    if (label) {
      ctx.fillStyle = color;
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${label}(${x},${y})`, px + 12, py - 10);
    }
  });

  ctx.restore();
};

// Optional: Add a simpler version for basic coordinate system
export const simpleCoordinateSystem = (ctx, wx, wy, PX_PER_UNIT, params = {}) => {
  const simplifiedParams = {
    ...params,
    showGrid: params.showGrid || false,
    backgroundColor: params.backgroundColor || "transparent",
    axisRange: params.axisRange || 7
  };
  
  return coordinateSystem(ctx, wx, wy, PX_PER_UNIT, simplifiedParams);
};