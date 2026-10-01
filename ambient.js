/* A quiet, touch-aware packet field behind the interface. */
(() => {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, ratio = 1, points = [], frame = 0;
  const pointer = { x: -1000, y: -1000 };
  const colors = ['167,242,237', '245,143,202', '255,180,92', '173,167,255'];

  function resize() {
    width = innerWidth; height = innerHeight;
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(44, Math.max(16, Math.round(width * height / 35000)));
    points = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width, y: Math.random() * height,
      vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
      radius: index % 7 === 0 ? 2.5 : 1.4,
      color: colors[index % colors.length]
    }));
    draw();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!reduced.matches) {
        point.x += point.vx; point.y += point.vy;
        if (point.x < -10 || point.x > width + 10) point.vx *= -1;
        if (point.y < -10 || point.y > height + 10) point.vy *= -1;
      }
      for (let j = i + 1; j < points.length; j++) {
        const other = points[j], distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance > 155) continue;
        context.strokeStyle = `rgba(167,242,237,${((155 - distance) / 155 * .12).toFixed(3)})`;
        context.lineWidth = 1;
        context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(other.x, other.y); context.stroke();
      }
      const nearPointer = Math.hypot(point.x - pointer.x, point.y - pointer.y) < 120;
      context.fillStyle = `rgba(${point.color},${nearPointer ? .72 : .35})`;
      context.beginPath(); context.arc(point.x, point.y, point.radius + (nearPointer ? 1 : 0), 0, Math.PI * 2); context.fill();
    }
  }

  function tick() {
    if (document.visibilityState === 'visible') draw();
    frame = requestAnimationFrame(tick);
  }
  addEventListener('resize', resize, { passive: true });
  addEventListener('pointermove', event => { pointer.x = event.clientX; pointer.y = event.clientY; }, { passive: true });
  addEventListener('pointerleave', () => { pointer.x = -1000; pointer.y = -1000; });
  reduced.addEventListener('change', () => { cancelAnimationFrame(frame); resize(); if (!reduced.matches) tick(); });
  resize();
  if (!reduced.matches) tick();
})();
