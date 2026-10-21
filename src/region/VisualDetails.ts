import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Original folded botanical meshes. Leaflets are actual tapered surfaces, not opaque crown balls. */
export function coastalFrond(): THREE.BufferGeometry {
  const p: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) =>
    p.push(...a, ...b, ...c);
  for (let i = 0; i < 17; i++) {
    const t = i / 17,
      y = 0.12 + t * 2.9,
      bend = -0.42 * t * t;
    const width = 0.13 + Math.sin(t * Math.PI) * 0.63;
    for (const side of [-1, 1]) {
      const a = [0, y, bend],
        b = [side * width, y + 0.34, bend - 0.13],
        c = [side * width * 0.67, y + 0.49, bend - 0.1],
        d = [0, y + 0.14, bend + 0.018];
      tri(a, b, c);
      tri(a, c, d);
    }
    tri([-0.025, y, bend], [0.025, y, bend], [0, y + 0.25, bend - 0.01]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  g.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      Array.from({ length: g.attributes.position.count * 2 }, (_, i) =>
        i % 2 ? 0.5 : 0,
      ),
      2,
    ),
  );
  return g;
}

export function tropicalCrown(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  // Curved broad leaves with a raised midrib; layered open crown, never solid spheres.
  for (let i = 0; i < 48; i++) {
    const angle=i*2.399,r=.15+(i%7)*.13,y=(i%5)*.24-.48;
    const vertices:number[]=[],uv:number[]=[];
    const point=(t:number,side:number)=>[side*Math.sin(Math.PI*t)*.28,Math.sin(t*Math.PI)*.16-Math.abs(side)*.06,t*.82];
    for(let j=0;j<5;j++)for(const side of [-1,1]) {
      const t=j/5,u=(j+1)/5;
      const a=point(t,0),b=point(t,side),c=point(u,side),d=point(u,0);
      const faces=side===1?[a,b,c,a,c,d]:[a,c,b,a,d,c];
      faces.forEach(v=>{vertices.push(...v);uv.push(v[0]/.6+.5,v[2]/.82);});
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
    g.rotateX(-0.4 + (i % 3) * 0.3);
    g.rotateY(angle);
    g.translate(Math.sin(angle) * r, y, Math.cos(angle) * r);
    pieces.push(g);
  }
  const merged = mergeGeometries(pieces)!;
  pieces.forEach((p) => p.dispose());
  return merged;
}

/** Matching physical grain and roughness: color stays the material's authored coastal palette. */
export function mineralFinish(
  material: THREE.MeshStandardMaterial,
  style: "asphalt" | "plaster" | "wood" | "metal",
  seed: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  let state = seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  ctx.fillStyle = "#bebebe";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 12000; i++) {
    const v = Math.floor(70 + random() * 160);
    ctx.fillStyle = `rgba(${v},${v},${v},.38)`;
    ctx.fillRect(
      random() * 256,
      random() * 256,
      style === "wood" ? 0.6 : 1,
      style === "wood" ? 12 + random() * 50 : 1,
    );
  }
  if (style === "asphalt")
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = "rgba(22,22,22,.23)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      let x = random() * 256,
        y = random() * 256;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += random() * 15 - 7;
        y += random() * 16;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(style === "asphalt" ? 12 : 2, style === "asphalt" ? 12 : 2);
  t.anisotropy = 4;
  material.bumpMap = t;
  material.bumpScale =
    style === "asphalt" ? 0.025 : style === "plaster" ? 0.016 : 0.009;
  material.roughnessMap = t;
  return t;
}

/** Analytic capillary waves and shelf color: no render target/reflection pass. */
export function coastalWater(material: THREE.MeshStandardMaterial) {
  const time = { value: 0 };
  material.roughness = 0.3;
  material.metalness = 0.26;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.coastTime = time;
    shader.vertexShader = "varying vec3 coastPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\ncoastPosition=(modelMatrix*vec4(transformed,1.0)).xyz;",
    );
    shader.fragmentShader =
      "uniform float coastTime; varying vec3 coastPosition;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float ripple=sin(coastPosition.x*1.7+coastPosition.z*.7+coastTime*.65)*sin(coastPosition.z*2.1-coastTime*.8);
      float broad=sin(coastPosition.x*.09+coastPosition.z*.12)*.5+.5;
      diffuseColor.rgb*=mix(vec3(.55,.78,.84),vec3(1.04,1.1,1.02),broad);
      diffuseColor.rgb+=vec3(.055,.08,.075)*smoothstep(.82,1.,ripple);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      normal=normalize(normal+vec3(sin(coastPosition.x*2.+coastTime)*.06,0.,cos(coastPosition.z*2.6-coastTime)*.06));`,
    );
  };
  material.customProgramCacheKey = () => "afterlight-coastal-water-v1";
  return (timeSeconds: number) => {
    time.value = timeSeconds;
  };
}
