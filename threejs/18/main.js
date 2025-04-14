import { ARButtonCustom } from './ARButtonCustom.js';

Bugfender.init({
  appKey: 'akOMxVZb98TxG0lOt8HWKxaEc9D4mqQU',
});

window.addEventListener('load', async () => {
  const THREE = await import('three');
  const GLTFLoaderModule = await import('three/addons/loaders/GLTFLoader.js');
  const GLTFLoader = GLTFLoaderModule.GLTFLoader;
  const OrbitControlsModule = await import('three/addons/controls/OrbitControls.js');
  const OrbitControls = OrbitControlsModule.OrbitControls;

  let ar_supported = false;

  let container;
  let camera, scene, renderer;
  let controller;
  let controls;

  let camera_fov = 35;
  let camera_near = 0.01;
  let camera_far = 20;

  let reticle;

  let hitTestSource = null;
  let hitTestSourceRequested = false;
  let planeFound = false;
  let noteGltf;

  let possui_instancia = false;
  let rodando_ar = false;

  function remove_note() {
    const existingMesh = scene.children.find(child => child.userData.isNoteMesh);
    if (existingMesh) {
      scene.remove(existingMesh);
    }

    possui_instancia = false;
  }

  function create_note(reticle_matrix = null) {
    if (!noteGltf) {
      Bugfender.log("noteGltf is null");
      return;
    }

    if (possui_instancia) {
      remove_note();
      return;
    }

    const mesh = noteGltf.scene.clone();

    if (reticle_matrix) {
      reticle_matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    } else {
      mesh.position.y -= 0.1;
    }

    mesh.userData.isNoteMesh = true;
    
    scene.add(mesh);

    possui_instancia = true;
  }

  function load_glb(glbPath) {
    function texture_from_glb(gltf, index_texture) {
      var indice_imagem = gltf.parser.json.textures[index_texture].source;

      const image = gltf.parser.json.images[indice_imagem];

      // Extraia os dados binários do bufferView
      const bufferView = gltf.parser.json.bufferViews[image.bufferView];
      const buffer = gltf.parser.extensions.KHR_binary_glTF.body;

      // Crie um array de bytes (Uint8Array) a partir dos dados binários
      const byteOffset = bufferView.byteOffset || 0;
      const byteLength = bufferView.byteLength;
      const imageData = new Uint8Array(buffer, byteOffset, byteLength);

      // Crie um Blob a partir dos dados binários
      const blob = new Blob([imageData], { type: image.mimeType });

      // Crie uma URL temporária para o Blob
      const imageUrl = URL.createObjectURL(blob);

      // Carregue a textura usando THREE.TextureLoader
      const textureLoader = new THREE.TextureLoader();
      const texture = textureLoader.load(imageUrl);
      texture.flipY = false;

      return texture;
    }

    function gerar_material_parallax(texture_color, texture_height, scale, minLayers, maxLayers) {
      var parameters = {
        uniforms: THREE.UniformsUtils.clone({
          "bumpMap": { type: "t", value: null },
          "map": { type: "t", value: null },
          "parallaxScale": { type: "f", value: null },
          "parallaxMinLayers": { type: "f", value: null },
          "parallaxMaxLayers": { type: "f", value: null }
        }),
        vertexShader: `
              varying vec2 vUv;
              varying vec3 vViewPosition;
              varying vec3 vNormal;
              void main() {
                  vUv = uv;
                  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
                  vViewPosition = -mvPosition.xyz;
                  vNormal = normalize( normalMatrix * normal );
                  gl_Position = projectionMatrix * mvPosition;
              }
          `,
        fragmentShader: `
              uniform sampler2D bumpMap;
              uniform sampler2D map;

              uniform float parallaxScale;
              uniform float parallaxMinLayers;
              uniform float parallaxMaxLayers;

              varying vec2 vUv;
              varying vec3 vViewPosition;
              varying vec3 vNormal;

              vec2 parallaxMap( in vec3 V ) {

                  // Determine number of layers from angle between V and N
                  float numLayers = mix( parallaxMaxLayers, parallaxMinLayers, abs( dot( vec3( 0.0, 0.0, 1.0 ), V ) ) );

                  float layerHeight = 1.0 / numLayers;

                  float currentLayerHeight = 1.0;
                  vec2 dtex = parallaxScale * V.xy / V.z / numLayers;
                  vec2 currentTextureCoords = vUv + dtex * numLayers;
                  float heightFromTexture = texture2D( bumpMap, currentTextureCoords ).r;
                  
                  for ( int i = 0; i == 0; i += 0 ) {
                      if ( heightFromTexture >= currentLayerHeight ) {
                          break;
                      }
                      currentLayerHeight -= layerHeight;
                      currentTextureCoords += dtex;

                      heightFromTexture = texture2D( bumpMap, currentTextureCoords ).r;
                  }
                  return currentTextureCoords;
              }

              vec2 perturbUv( vec3 surfPosition, vec3 surfNormal, vec3 viewPosition ) {
                  vec2 texDx = dFdx( vUv );
                  vec2 texDy = dFdy( vUv );
                  vec3 vSigmaX = dFdx( surfPosition );
                  vec3 vSigmaY = dFdy( surfPosition );
                  vec3 vR1 = cross( vSigmaY, surfNormal );
                  vec3 vR2 = cross( surfNormal, vSigmaX );
                  float fDet = dot( vSigmaX, vR1 );
                  vec2 vProjVscr = ( 1.0 / fDet ) * vec2( dot( vR1, viewPosition ), dot( vR2, viewPosition ) );
                  vec3 vProjVtex;
                  vProjVtex.xy = texDx * vProjVscr.x + texDy * vProjVscr.y;
                  vProjVtex.z = dot( surfNormal, viewPosition );
                  return parallaxMap( vProjVtex );
              }

              void main() {
                  // Perturba as coordenadas UV com base no mapeamento de parallax
                  vec2 mapUv = perturbUv( -vViewPosition, normalize( vNormal ), normalize( vViewPosition ) );
                  
                  // Obtém a cor da textura usando as coordenadas UV perturbadas
                  gl_FragColor = texture2D( map, mapUv );
              }
          `
      };
      parameters.uniforms['parallaxScale'].value = -1.0 * scale;
      parameters.uniforms['parallaxMinLayers'].value = minLayers;
      parameters.uniforms['parallaxMaxLayers'].value = maxLayers;

      const material = new THREE.ShaderMaterial(parameters);

      material.map = texture_color;
      material.bumpMap = texture_height;

      material.map.flipY = false;
      material.bumpMap.flipY = false;

      material.map.anisotropy = 4;
      material.bumpMap.anisotropy = 4;
      parameters.uniforms['map'].value = material.map;
      parameters.uniforms['bumpMap'].value = material.bumpMap;

      material.needsUpdate = true;

      return material;
    }

    const loader = new GLTFLoader();

    loader.load(glbPath, (gltf) => {
      gltf.scene.traverse(function (child) {
        try {
          if (child.isMesh && child.material.userData.parallaxMapping) {
            var parallaxConfig = child.material.userData.parallaxMapping;

            var bumpMapTexture = texture_from_glb(gltf, parallaxConfig.index_texture);
            var mapTexture = new THREE.CanvasTexture(child.material.map.source.data);

            const material_parallax = gerar_material_parallax(
              mapTexture,
              bumpMapTexture,
              parallaxConfig.scale,
              parallaxConfig.minLayers,
              parallaxConfig.maxLayers,
            );

            child.material = material_parallax;
          }
        } catch (error) {	
          Bugfender.error("04 - Error processing material:", error);
        }
      });

      console.log(gltf)
      
      noteGltf = gltf;

      create_note();
    });
  }

  function posicionar_camera() {
    let aspect = window.innerWidth / window.innerHeight;
    const fator_tela = 0.2 / Math.min(aspect,1);

    camera.position.set(0.0, 2*fator_tela, 3*fator_tela);
    camera.lookAt(0, 0, 0);

    camera.fov = camera_fov;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.near = camera_near;
    camera.far = camera_far;

    camera.updateProjectionMatrix();
  }

  // check for webxr session support
  if ("xr" in navigator) {
    console.log(navigator);

    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      ar_supported = supported;
      
      init();
      animate();
    });
  } else {
    console.log("WebXR not supported");
  }

  function sessionStart() {
    planeFound = false;
    //show #tracking-prompt
    document.getElementById("tracking-prompt").style.display = "block";
  }

  function init() {
    container = document.getElementById("threejs_canvas");
    document.body.appendChild(container);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      camera_fov,
      window.innerWidth / window.innerHeight,
      camera_near,
      camera_far
    );

    posicionar_camera();

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    if (ar_supported) {
      renderer.xr.enabled = true;

      renderer.xr.addEventListener("sessionstart", sessionStart);

      document.body.appendChild(
        ARButtonCustom.createButton(renderer, {
          requiredFeatures: ["local", "hit-test"],
        })
      );
    }

    function onSelect(ar_mode = true) {
      if (possui_instancia) {
        remove_note();
        return;
      }

      if (noteGltf.scene && (! ar_mode || reticle.visible)) {
        create_note(reticle.matrix);
      }
    }

    const glbSelector = document.getElementById("glbSelector");

    const selectedFile = glbSelector.value;
    const glbPath = "../examples/glb/" + selectedFile;

    load_glb(glbPath);

    controller = renderer.xr.getController(0);
    controller.addEventListener("select", onSelect);
    scene.add(controller);
    
    controls = new OrbitControls(camera, renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const reticleTexture = textureLoader.load('../examples/image/reticle.png');

    reticle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: reticleTexture, transparent: true })
    );

    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener("resize", onWindowResize);

    glbSelector.addEventListener("change", (event) => {
      const selectedFile = event.target.value;
      const glbPath = "../examples/glb/" + selectedFile;
      
      // Remove the existing model
      remove_note();

      // Load the new GLB file
      load_glb(glbPath);
    });
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    renderer.setAnimationLoop(render);
  }

  function render(timestamp, frame) {
    // Bugfender.log("frame", frame);

    if (frame) {
      if (rodando_ar === false) {
        remove_note();
        rodando_ar = true;
      }

      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      if (hitTestSourceRequested === false) {
        session.requestReferenceSpace("viewer").then(function (referenceSpace) {
          session
            .requestHitTestSource({ space: referenceSpace })
            .then(function (source) {
              hitTestSource = source;
            });
        });

        session.addEventListener("end", function () {
          hitTestSourceRequested = false;
          hitTestSource = null;
        });

        hitTestSourceRequested = true;
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length) {
          if (!planeFound) {
            planeFound = true;
            //hide #tracking-prompt
            document.getElementById("tracking-prompt").style.display = "none";
            // document.getElementById("instructions").style.display = "flex";
          }
          const hit = hitTestResults[0];

          if (! possui_instancia) {
            reticle.visible = true;
            reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
          } else {
            reticle.visible = false;
          }
      } else {
          if (planeFound) {
            planeFound = false;
          }

          if (! possui_instancia) {
            document.getElementById("tracking-prompt").style.display = "block";
          } else {
            document.getElementById("tracking-prompt").style.display = "none";
          }

          reticle.visible = false;
        }
      }
    } else {
      if (rodando_ar === true) {
        posicionar_camera();

        remove_note();
        create_note();

        rodando_ar = false;
      }
    }

    renderer.render(scene, camera);
  }
});