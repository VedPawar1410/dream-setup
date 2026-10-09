import { Color, ShaderMaterial, type Plane } from 'three'
import { atmo } from './atmosphere'

// The view through every window is drawn by one small fragment shader: sky, sun or moon,
// stars, two layers of hills, falling rain or snow, and droplets on the glass. It's all
// driven by uniforms, so weather transitions are just uniform changes.

/** Shared by every window: update once per frame and every window follows. */
export const viewUniforms = {
  uTime: { value: 0 },
  uSkyTop: { value: new Color() },
  uSkyBottom: { value: new Color() },
  uHillsFar: { value: new Color() },
  uHills: { value: new Color() },
  uDisc: { value: new Color() },
  uDiscY: { value: 0.8 },
  uStars: { value: 0 },
  uRain: { value: 0 },
  uSnow: { value: 0 },
  uGlow: { value: 1 },
}

export function syncViewUniforms(time: number) {
  const u = viewUniforms
  u.uTime.value = time
  u.uSkyTop.value.copy(atmo.skyTop)
  u.uSkyBottom.value.copy(atmo.skyBottom)
  u.uHillsFar.value.copy(atmo.hillsFar)
  u.uHills.value.copy(atmo.hills)
  u.uDisc.value.copy(atmo.disc)
  u.uDiscY.value = atmo.discY
  u.uStars.value = atmo.stars
  u.uRain.value = atmo.rain
  u.uSnow.value = atmo.snow
  u.uGlow.value = atmo.viewGlow
}

const vertexShader = /* glsl */ `
  #include <common>
  #include <clipping_planes_pars_vertex>
  varying vec2 vUv;
  varying vec3 vView; // direction from the glass to the camera, in the glass's own space

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    // The window is only rotated (never scaled), so the transpose undoes its rotation
    vView = normalize(transpose(mat3(modelMatrix)) * (cameraPosition - worldPos.xyz));
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <clipping_planes_vertex>
  }
`

const fragmentShader = /* glsl */ `
  #include <common>
  #include <clipping_planes_pars_fragment>
  uniform float uTime, uDiscY, uStars, uRain, uSnow, uGlow, uAspect;
  uniform vec3 uSkyTop, uSkyBottom, uHillsFar, uHills, uDisc;
  varying vec2 vUv;
  varying vec3 vView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    #include <clipping_planes_fragment>

    // Parallax: a point on a layer behind the glass is offset by the viewing angle times
    // its depth, so far hills drift less than near ones as the camera moves.
    vec2 look = -vView.xy / max(vView.z, 0.25);
    vec2 uv = vec2(vUv.x * uAspect, vUv.y);

    vec2 sky = uv + look * 0.15;
    vec3 col = mix(uSkyBottom, uSkyTop, smoothstep(0.15, 1.1, sky.y));

    vec2 sg = floor(sky * 40.0);
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash(sg + 1.0) * 6.28);
    col += vec3(step(0.985, hash(sg)) * twinkle) * uStars * smoothstep(0.35, 0.6, sky.y);

    float d = length(sky - vec2(uAspect * 0.68, uDiscY));
    col += uDisc * (smoothstep(0.075, 0.065, d) * 1.5 + exp(-d * 9.0) * 0.35);

    vec2 far = uv + look * 0.25;
    float h1 = 0.36 + 0.05 * sin(far.x * 5.0 + 1.3) + 0.025 * sin(far.x * 13.0);
    col = mix(col, uHillsFar, smoothstep(h1 + 0.004, h1 - 0.004, far.y));
    vec2 near = uv + look * 0.45;
    float h2 = 0.2 + 0.06 * sin(near.x * 3.0 + 4.0) + 0.02 * sin(near.x * 11.0 + 2.0);
    col = mix(col, uHills, smoothstep(h2 + 0.004, h2 - 0.004, near.y));

    if (uRain > 0.001) {
      // Streaks: thin columns with a bright fragment sliding down each one
      vec2 r = vec2(uv.x * 70.0, uv.y * 2.5 + uTime * 5.0);
      float lane = floor(r.x);
      float drop = fract(r.y + hash(vec2(lane, 0.0)) * 10.0);
      float streak = smoothstep(0.92, 1.0, drop) * (1.0 - abs(fract(r.x) - 0.5) * 2.0);
      col = mix(col * (1.0 - 0.15 * uRain), vec3(0.78, 0.84, 0.92), streak * 0.4 * uRain);
    }

    if (uSnow > 0.001) {
      for (int i = 0; i < 2; i++) {
        float scale = 14.0 + float(i) * 10.0;
        vec2 s = uv * scale;
        s.y += uTime * (0.8 + float(i) * 0.5);
        s.x += sin(uTime * 0.7 + s.y * 0.5) * 0.3;
        vec2 cell = floor(s);
        vec2 off = vec2(hash(cell), hash(cell + 7.0)) - 0.5;
        float flake = smoothstep(0.12, 0.0, length(fract(s) - 0.5 - off * 0.6)) * step(0.4, hash(cell + 3.0));
        col = mix(col, vec3(1.0), flake * uSnow);
      }
    }

    if (uRain > 0.001) {
      // Droplets on the glass itself: no parallax, sliding slowly down
      vec2 g = vUv * vec2(uAspect, 1.0) * 9.0;
      g.y += uTime * 0.04;
      vec2 cell = floor(g);
      vec2 off = (vec2(hash(cell + 11.0), hash(cell + 17.0)) - 0.5) * 0.6;
      float radius = 0.08 + 0.12 * hash(cell + 5.0);
      float drop = smoothstep(radius, radius - 0.03, length(fract(g) - 0.5 - off)) * step(0.35, hash(cell + 9.0));
      col = mix(col, col * 0.7 + vec3(0.25), drop * uRain * 0.8);
    }

    // Slight darkening near the frame reads as depth
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.08, 1.0 - vUv.y);
    gl_FragColor = vec4(col * mix(0.75, 1.0, edge) * uGlow, 1.0);
  }
`

/** One material per window (its own aspect ratio), sharing the weather uniforms by reference. */
export function makeWindowMaterial(aspect: number, clip: Plane[]) {
  return new ShaderMaterial({
    uniforms: { ...viewUniforms, uAspect: { value: aspect } },
    vertexShader,
    fragmentShader,
    clipping: true, // honour the wall cutaway like every other material
    clippingPlanes: clip,
  })
}
