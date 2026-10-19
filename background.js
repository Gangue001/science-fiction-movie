// Adapted from the shader example supplied for this project.
// A full-screen shader needs no Three.js scene or recording dependencies.
(() => {
  const host = document.querySelector('.starfield');
  if (!host) return;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return; // Keep the CSS starfield on devices without WebGL.

  const vertexSource = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    // Local procedural noise replaces the external noise texture.
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    mat2 rotate2d(float a) {
      return mat2(cos(a), sin(a), -sin(a), cos(a));
    }
    float starLayer(vec2 uv, float layer) {
      float depth = fract(u_time * .025 + layer / 4.);
      float scale = mix(38., 5., depth);
      vec2 p = rotate2d(u_time * .008) * uv * scale + layer * 23.7;
      vec2 id = floor(p), cell = fract(p);
      float seed = hash(id + layer);
      vec2 center = vec2(hash(id + 7.3), hash(id + 19.1)) * .6 + .2;
      float distanceToStar = length(cell - center);
      float radius = mix(.025, .055, depth);
      float star = 1. - smoothstep(0., radius, distanceToStar);
      float halo = (1. - smoothstep(0., radius * 3., distanceToStar)) * .18;
      float fade = smoothstep(0., .18, depth) * (1. - smoothstep(.75, 1., depth));
      float twinkle = .7 + .3 * sin(u_time * .7 + seed * 60.);
      return (star + halo) * step(.975, seed) * fade * twinkle;
    }
    void main() {
      vec2 uv = (gl_FragCoord.xy - .5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      // A flat deep-space base avoids expensive per-pixel fractal noise.
      vec3 colour = vec3(.0235, .0353, .0353);
      float stars = 0.;
      for (int i = 0; i < 4; i++) stars += starLayer(uv, float(i));
      colour += stars * vec3(.82, .95, .90) * 1.35;
      float vignette = 1. - smoothstep(.2, 1.5, length(uv)) * .45;
      gl_FragColor = vec4(colour * vignette, 1.);
    }
  `;
  let program, buffer;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Background shader unavailable');
    }
    return shader;
  }
  try {
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Background unavailable');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  } catch {
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    return;
  }
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const time = gl.getUniformLocation(program, 'u_time');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, elapsed = 12, previous = 0, lost = false;
  function draw() {
    gl.uniform1f(time, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function resize() {
    if (lost) return;
    // Limit the pixel budget for phones and high-density monitors.
    const ratio = Math.min(devicePixelRatio || 1, 1, 1000 / Math.max(innerWidth, innerHeight));
    canvas.width = Math.max(1, Math.round(innerWidth * ratio));
    canvas.height = Math.max(1, Math.round(innerHeight * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    draw();
  }
  function animate(now) {
    if (previous && now - previous < 1000 / 24) {
      frame = requestAnimationFrame(animate);
      return;
    }
    if (previous) elapsed += Math.min((now - previous) / 1000, .1);
    previous = now;
    draw();
    frame = requestAnimationFrame(animate);
  }
  function syncMotion() {
    cancelAnimationFrame(frame);
    previous = 0;
    if (lost) return;
    draw();
    if (!document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(animate);
  }
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    cancelAnimationFrame(frame);
    host.classList.remove('shader-ready');
    canvas.remove();
  });
  host.append(canvas);
  resize();
  host.classList.add('shader-ready');
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', syncMotion);
  reducedMotion.addEventListener('change', syncMotion);
  syncMotion();
})();
