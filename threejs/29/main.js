import { ARButtonCustom } from './ARButtonCustom.js';

Bugfender.init({
  appKey: 'akOMxVZb98TxG0lOt8HWKxaEc9D4mqQU',
});

Bugfender.log('inicio')

const DEBUG = false;

function enviarLog(mensagem) {
  if (DEBUG) {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: mensagem }),
    })
    .catch((e) => {
      // Em produção, talvez ignore ou trate erro de rede
      console.error("Erro ao enviar log:", e);
    });
  }
}

enviarLog('inicio');

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

  const reticleParent = new THREE.Object3D();
  let reticle;
  let mesh_note;

  let hitTestSource = null;
  let hitTestSourceRequested = false;
  let planeFound = false;
  let noteGltf;

  let possui_instancia = false;
  let rodando_ar = false;
  let note_fixado = false;

  let rotacao_note = 0;
  let isSelecting = false;
  let lastPosition = new THREE.Vector3();
  let touchTimestamp;
  let lastX = null;

  let rotacionando_esquerda = false;
  let rotacionando_direita = false;
  let fator_rotacao = 3;

  let overlay_listeners_created = false;

  function remove_note() {
    const existingMesh = scene.children.find(child => child.userData.isNoteMesh);
    if (existingMesh) {
      scene.remove(existingMesh);
    }

    possui_instancia = false;
  }

  function create_note_matrix(matrix = null) {
    if (matrix) {
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, quaternion, scale);
      create_note(position, quaternion, scale);
    } else {
      create_note();
    }
  }

  function create_note(position = null, quaternion = null, scale = null) {
    if (!noteGltf) {
      Bugfender.log("noteGltf is null");
      return;
    }

    if (possui_instancia) {
      remove_note();
      return;
    }

    const mesh = noteGltf.scene.clone();

    if (position && quaternion && scale) {
      mesh.position.copy(position);
      mesh.quaternion.copy(quaternion);
      mesh.scale.copy(scale);
    } else {
      mesh.position.y -= 0.1;
    }

    mesh.userData.isNoteMesh = true;

    mesh_note = mesh;
    
    scene.add(mesh);

    possui_instancia = true;
  }

  function load_glb(glbPath) {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex'; // Show loading overlay

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

      // console.log(gltf)
      
      noteGltf = gltf;

      mesh_note = noteGltf.scene.clone();

      create_note_matrix();
      loadingOverlay.style.display = 'none'; // Hide loading overlay after model is loaded
    },

    function ( xhr ) {
      const percentage = Math.min( Math.round( xhr.loaded / xhr.total * 100 ) , 100 );
      document.getElementById('loading-percentage').innerText = percentage + '%';

      const circle = document.querySelector('.loader-circle');
      const circumference = 377; // Stroke-dasharray value
      const offset = circumference - percentage / 100 * circumference;
      circle.style.strokeDashoffset = offset;
    },

    function ( error ) {
      console.log( 'An error happened' );
      loadingOverlay.style.display = 'none'; // Hide loading overlay if there's an error
    }
    );
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
    // console.log(navigator);

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

    const glbSelector = document.getElementById("glbSelector");

    const selectedFile = glbSelector.value;
    const glbPath = "../examples/glb/" + selectedFile;

    load_glb(glbPath);
    
    controller = renderer.xr.getController(0);

    // controller.addEventListener("selectstart", () => {
    //     isSelecting = true;
    //     controller.getWorldPosition(lastPosition);

    //     touchTimestamp = performance.now();
    // });
    
    // controller.addEventListener("selectend", () => {
    //     const touchEndTimestamp = performance.now();
    //     const timeDiff = touchEndTimestamp - touchTimestamp;

    //     if (timeDiff < 150) {
    //       if (! possui_instancia) {
    //         enviarLog("Nao existe instancia da mesh.");
    //       }

    //       note_fixado = ! note_fixado;
    //     }

    //     isSelecting = false;

    //     lastTouchPosition = null;
    //     lastCameraPosition = null;
    // });
    
    controller.addEventListener("selectend", () => {
      rotacionando_direita = false;
      rotacionando_esquerda = false;
    });

    scene.add(controller);

    controls = new OrbitControls(camera, renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const reticleTexture = textureLoader.load('../examples/image/reticle.png');

    reticle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: reticleTexture, transparent: true })
    );
    reticleParent.add(reticle);

    reticleParent.matrixAutoUpdate = false;
    reticleParent.visible = false;
    scene.add(reticleParent);

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
    if (frame) {
      if (rodando_ar === false) {
        remove_note();
        rodando_ar = true;

        create_note();
        mesh_note.visible = false;
      }

      if (! overlay_listeners_created) {
        const botaoSetaEsquerda = document.getElementById("botao-seta-esquerda");

        botaoSetaEsquerda.addEventListener("pointerdown", (event) => {
          if (! rotacionando_direita) {
            rotacionando_esquerda = true;
          }
        });

        botaoSetaEsquerda.addEventListener("pointerup", (event) => {
          rotacionando_esquerda = false;
        });

        botaoSetaEsquerda.addEventListener("click", (event) => {
          rotacionando_esquerda = false;
        });

        const botaoSetaDireita = document.getElementById("botao-seta-direita");

        botaoSetaDireita.addEventListener("pointerdown", (event) => {
          if (! rotacionando_esquerda) {
            rotacionando_direita = true;
          }
        });

        botaoSetaDireita.addEventListener("pointerup", (event) => {
          rotacionando_direita = false;
        });

        botaoSetaDireita.addEventListener("click", (event) => {
          rotacionando_direita = false;
        });

        const tapPrompt = document.getElementById("tap-prompt");

        tapPrompt.addEventListener("click", (event) => {
          note_fixado = ! note_fixado;
        });

        overlay_listeners_created = true;
      }

      if (rotacionando_direita) {
        rotacao_note += 1 * fator_rotacao;
      } else if (rotacionando_esquerda) {
        rotacao_note -= 1 * fator_rotacao;
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
            document.getElementById("tracking-prompt").style.display = "none";
          }
          const hit = hitTestResults[hitTestResults.length-1];

          mesh_note.visible = true;
          possui_instancia = true;

          const xrMatrixArray = hit.getPose(referenceSpace).transform.matrix;

          const hitMatrix = new THREE.Matrix4();
          hitMatrix.fromArray(xrMatrixArray);

          const position_from_device = new THREE.Vector3();
          const quaternion_from_device = new THREE.Quaternion();
          const scale_from_device = new THREE.Vector3();

          hitMatrix.decompose(position_from_device, quaternion_from_device, scale_from_device);

          const quaternion = new THREE.Quaternion();

          quaternion.setFromEuler( new THREE.Euler(0, THREE.MathUtils.degToRad(rotacao_note), 0) );
          mesh_note.quaternion.copy(quaternion);

          if (! note_fixado) {
            mesh_note.position.copy(position_from_device);
            mesh_note.scale.copy(scale_from_device);
          }

          document.getElementById("prompts-container").style.display = "block";
        } else {
          if (planeFound) {
            planeFound = false;
          }

          if (! note_fixado) {
            possui_instancia = false;
            mesh_note.visible = false;
          document.getElementById("prompts-container").style.display = "none";
          document.getElementById("tracking-prompt").style.display = "block";
          } else {
            document.getElementById("tracking-prompt").style.display = "none";
          }

          reticleParent.visible = false;
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
