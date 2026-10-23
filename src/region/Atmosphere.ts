import * as THREE from "three";

/** Region-only presentation. Reuses the existing water draws and light budget. */
export function createCoastalAtmosphere(root: THREE.Object3D) {
  const time = { value: 0 };
  const materials = new Map<
    THREE.MeshStandardMaterial,
    {
      compile: THREE.Material["onBeforeCompile"];
      cacheKey: THREE.Material["customProgramCacheKey"];
    }
  >();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const list = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of list) {
      if (
        !(material instanceof THREE.MeshStandardMaterial) ||
        materials.has(material) ||
        material.customProgramCacheKey() !== "afterlight-coastal-water-v1"
      )
        continue;
      materials.set(material, {
        compile: material.onBeforeCompile,
        cacheKey: material.customProgramCacheKey,
      });
      material.onBeforeCompile = (shader) => {
        shader.uniforms.coastalBreezeTime = time;
        shader.vertexShader =
          "varying vec3 coastalPosition; varying float coastalSurface;\n" +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
          coastalPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
          coastalSurface = step(.8, normalize(mat3(modelMatrix) * normal).y);`,
        );
        shader.fragmentShader =
          "uniform float coastalBreezeTime; varying vec3 coastalPosition; varying float coastalSurface;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float swell = sin(coastalPosition.x * .22 + coastalPosition.z * .38 - coastalBreezeTime * .32);
          float ripple = sin(coastalPosition.z * 3.1 + coastalPosition.x * .65 - coastalBreezeTime * .55 + swell * 1.4);
          float breakup = sin(coastalPosition.x * 1.15 + coastalPosition.z * .23 + coastalBreezeTime * .17) * .5 + .5;
          float glint = smoothstep(.90, 1.0, ripple) * smoothstep(.25, .8, breakup);
          vec3 waterColor = diffuseColor.rgb * mix(vec3(.64,.86,.94), vec3(.94,1.10,1.08), swell * .5 + .5);
          waterColor += vec3(.10,.14,.13) * glint;
          diffuseColor.rgb = mix(diffuseColor.rgb, waterColor, coastalSurface);`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec3 breezeNormal = vec3(cos(coastalPosition.x * .65 + coastalPosition.z * 3.1 - coastalBreezeTime * .55) * .035,
            0.0, cos(coastalPosition.z * .38 - coastalBreezeTime * .32) * .055);
          normal = normalize(normal + mat3(viewMatrix) * breezeNormal * coastalSurface);`,
        );
      };
      material.customProgramCacheKey = () =>
        "tidehaven-region-coastal-breeze-v1";
      material.needsUpdate = true;
    }
  });
  return {
    update(dt: number, paused: boolean, reducedMotion: boolean) {
      if (!paused && !reducedMotion)
        time.value += Math.min(Math.max(dt, 0), 0.05);
    },
    dispose() {
      for (const [material, original] of materials) {
        material.onBeforeCompile = original.compile;
        material.customProgramCacheKey = original.cacheKey;
        material.needsUpdate = true;
      }
      materials.clear();
    },
  };
}
