import { ARButton } from './ARButton.js';

// function console.log(text) {
//   fetch('/log/', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ message: text })
//   }).catch(() => { });
// }

console.log('inicio')

const neutral_lighting = {
    topLight: {
        intensity: 3.9603,
        position: [0.5, 14.0, 0.5],
    },
    room: {
        position: [0.0, 13.2, 0.0],
        scale: [31.5, 28.5, 31.5],
    },
    boxes: [
        {
            position: [-10.906, -1, 1.846],
            rotation: -0.195,
            scale: [2.328, 7.905, 4.651],
        },
        {
            position: [-5.607, -0.754, -0.758],
            rotation: 0.994,
            scale: [1.970, 1.534, 3.955],
        },
        {
            position: [6.167, -0.16, 7.803],
            rotation: 0.561,
            scale: [3.927, 6.285, 3.687],
        },
        {
            position: [-2.017, 0.018, 6.124],
            rotation: 0.333,
            scale: [2.002, 4.566, 2.064],
        },
        {
            position: [2.291, -0.756, -2.621],
            rotation: -0.286,
            scale: [1.546, 1.552, 1.496],
        },
        {
            position: [-2.193, -0.369, -5.547],
            rotation: 0.516,
            scale: [3.875, 3.487, 2.986],
        },
    ],
    lights: [
        {
            intensity: 1.9512,
            position: [-14, 10.0, 8.0],
        },
        {
            intensity: 1.9512,
            position: [-14, 14.0, -4],
        },
        {
            intensity: 0.5609,
            position: [14.0, 12.0, 0.0],
        },
        {
            intensity: 6.0975,
            position: [0.0, 2.0, 14.0],
        },
        {
            intensity: 1.9512,
            position: [7.0, 8.0, -14],
        },
        {
            intensity: 1.9512,
            position: [-7, 16.0, -14],
        },
        {
            intensity: 0.0244,
            position: [0.0, 20.0, 0.0],
        },
    ]
};

window.addEventListener('load', async () => {
  const THREE = await import('three');
  const GLTFLoaderModule = await import('three/addons/loaders/GLTFLoader.js');
  const GLTFLoader = GLTFLoaderModule.GLTFLoader;
  const OrbitControlsModule = await import('three/addons/controls/OrbitControls.js');
  const OrbitControls = OrbitControlsModule.OrbitControls;
  const DRACOLoaderModule = await import('three/addons/loaders/DRACOLoader.js');
  const DRACOLoader = DRACOLoaderModule.DRACOLoader;

  class EnvironmentScene extends THREE.Scene {
      constructor() {
          super();
          // this.position.y = -3.5;
          const geometry = new THREE.BoxGeometry();
          geometry.deleteAttribute('uv');
          const roomMaterial = new THREE.MeshStandardMaterial({ metalness: 0, side: THREE.BackSide });
          const boxMaterial = new THREE.MeshStandardMaterial({ metalness: 0 });
          const data = neutral_lighting;

          const mainLight = new THREE.AmbientLight(0xffffff, data.topLight.intensity);
          mainLight.position.set(...data.topLight.position);
          this.add(mainLight);

          const room = new THREE.Mesh(geometry, roomMaterial);
          room.position.set(...data.room.position);
          room.scale.set(...data.room.scale);
          room.visible = false;
          this.add(room);

          for (const box of data.boxes) {
              const box1 = new THREE.Mesh(geometry, boxMaterial);
              box1.position.set(...box.position);
              box1.rotation.set(0, box.rotation, 0);
              box1.scale.set(...box.scale);
              box1.visible = false;
              this.add(box1);
          }

          for (const light of data.lights) {
              const light1 = new THREE.DirectionalLight(0xffffff, light.intensity);
              light1.position.set(...light.position);
              this.add(light1);
          }
      }
      createAreaLightMaterial(intensity) {
          const material = new THREE.MeshBasicMaterial();
          material.color.setScalar(intensity);
          return material;
      }
  }

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/'); // ou caminho local
  dracoLoader.setDecoderConfig({ type: 'js' }); // ou wasm se preferir

  let ar_supported = false;

  let container;
  let camera, scene, renderer;
  let controller;
  let controls;

  let camera_fov = 35;
  let camera_near = 0.01;
  let camera_far = 20;

  let mesh_note;

  let hitTestSource = null;
  let hitTestSourceRequested = false;
  let planeFound = false;
  let noteGltf;

  let possui_instancia = false;
  let rodando_ar = false;

  let rotacionando_esquerda = false;
  let rotacionando_direita = false;

  let overlay_listeners_created = false;

  const HIT_ANGLE_DEG = 20;
  let transientHitTestSource = null;
  const ROTATION_SPEED = Math.PI / 90;
  const raycaster = new THREE.Raycaster();
  let inputSource = null;
  let hitPlane = null;
  let interactionWithUI = false;

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
      console.log("noteGltf is null");
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

    hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000));
    hitPlane.position.copy(mesh.position);
    hitPlane.rotation.x = -Math.PI / 2;
    hitPlane.visible = false;
    hitPlane.material.side = THREE.DoubleSide;

    scene.add(hitPlane);

    posicionar_camera();

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
    loader.setDRACOLoader(dracoLoader);

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
          console.error("04 - Error processing material:", error);
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

    const box = new THREE.Box3().setFromObject(mesh_note);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center).add(new THREE.Vector3(
      0, 
      -size/20, 
      0
    ));

    camera.position.copy(center).add(new THREE.Vector3(
      0, 
      2*fator_tela, 
      3*fator_tela
    ));

    controls.update();

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

    scene = new EnvironmentScene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(
      camera_fov,
      window.innerWidth / window.innerHeight,
      camera_near,
      camera_far
    );

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.45;
    container.appendChild(renderer.domElement);

    if (ar_supported) {
      renderer.xr.enabled = true;

      renderer.xr.addEventListener("sessionstart", sessionStart);

      document.body.appendChild(
        ARButton.createButton(renderer, {
          requiredFeatures: ["local", "hit-test"],
        })
      );
    }

    const glbPath = container.getAttribute('glb_file');

    load_glb(glbPath);
    
    controller = renderer.xr.getController(0);
    
    controller.addEventListener("selectend", () => {
      rotacionando_direita = false;
      rotacionando_esquerda = false;
    });

    scene.add(controller);

    controls = new OrbitControls(camera, renderer.domElement);

    window.addEventListener("resize", onWindowResize);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    renderer.setAnimationLoop(render);
  }

  async function render(timestamp, frame) {
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
          event.preventDefault();
          interactionWithUI = true;
          if (! rotacionando_direita) {
            rotacionando_esquerda = true;
          }
        });

        botaoSetaEsquerda.addEventListener("pointerup", (event) => {
          event.preventDefault();
          rotacionando_esquerda = false;
          setTimeout(() => { interactionWithUI = false; }, 100);
        });

        botaoSetaEsquerda.addEventListener("click", (event) => {
          event.preventDefault();
          rotacionando_esquerda = false;
          setTimeout(() => { interactionWithUI = false; }, 100);
        });

        const botaoSetaDireita = document.getElementById("botao-seta-direita");

        botaoSetaDireita.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          interactionWithUI = true;
          if (! rotacionando_esquerda) {
            rotacionando_direita = true;
          }
        });

        botaoSetaDireita.addEventListener("pointerup", (event) => {
          event.preventDefault();
          rotacionando_direita = false;
          setTimeout(() => { interactionWithUI = false; }, 100);
        });

        botaoSetaDireita.addEventListener("click", (event) => {
          event.preventDefault();
          rotacionando_direita = false;
          setTimeout(() => { interactionWithUI = false; }, 100);
        });

        overlay_listeners_created = true;
      }

      try {
        if (rotacionando_direita) {
          mesh_note.rotateY(ROTATION_SPEED);
        } else if (rotacionando_esquerda) {
          mesh_note.rotateY(-ROTATION_SPEED);
        }
      } catch (error) {
        console.log("Erro ao rotacionar o notebook: " + error);
      }

      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      session.addEventListener("selectstart", (event) => {
        if (!transientHitTestSource) {
          return;
        }

        const fingers = frame.getHitTestResultsForTransientInput(transientHitTestSource);

        if (fingers.length === 1) {
          inputSource = event.inputSource;
        }
      })

      if (hitTestSourceRequested === false) {
        const radians = HIT_ANGLE_DEG * Math.PI / 180;
        const ray = new XRRay(new DOMPoint(0, 0, 0), { x: 0, y: -Math.sin(radians), z: -Math.cos(radians) });

        session.requestReferenceSpace("viewer").then(function (referenceSpace) {
          session
            .requestHitTestSource({ space: referenceSpace, offsetRay: ray })
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

      if (!mesh_note.visible && hitTestSource) {
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

          mesh_note.position.copy(position_from_device);
          mesh_note.quaternion.copy(quaternion_from_device);
          mesh_note.scale.copy(scale_from_device);

          document.getElementById("prompts-container").style.display = "block";

          if (!transientHitTestSource) {
            try {
              transientHitTestSource = await session.requestHitTestSourceForTransientInput({
                profile: 'generic-touchscreen'
              });
            } catch (err) {
              console.log("Erro ao solicitar transient hit test source:", err);
              transientHitTestSource = null;
            }
          }
        } else {
          if (planeFound) {
            planeFound = false;
          }

          if (!mesh_note.visible) {
            possui_instancia = false;
            mesh_note.visible = false;
            document.getElementById("prompts-container").style.display = "none";
            document.getElementById("tracking-prompt").style.display = "block";
          } else {
            document.getElementById("tracking-prompt").style.display = "none";
          }
        }
      } else if (mesh_note.visible && transientHitTestSource && !rotacionando_direita && !rotacionando_esquerda && !interactionWithUI) {
        function getHit(object) {
          const hits = raycaster.intersectObject(object, true);
          return hits.find((hit) => hit.object.visible && !hit.object.userData.noHit);
        }

        function hitFromPoint(ndcPosition, object) {
          raycaster.setFromCamera(ndcPosition, camera);
          return getHit(object);
        }

        function positionAndNormalFromPoint(ndcPosition, object) {
          const hit = hitFromPoint(ndcPosition, object);
          if (hit == null) {
            return null;
          }
          const position = hit.point;
          return position;
        }

        function getTouchLocation() {
          const { axes } = inputSource.gamepad;
          const vector2 = new THREE.Vector2(axes[0], -axes[1]);
          hitPlane.visible = true;
          let location = positionAndNormalFromPoint(vector2, hitPlane);
          hitPlane.visible = false;

          if (!location) {
            return null;
          }
          return location;
        }

        const fingers = frame.getHitTestResultsForTransientInput(transientHitTestSource);

        if (fingers.length == 1) {
          let finger = fingers[0];
          let hit = null;

          if (finger.results.length > 0) {
            const pose = finger.results[0].getPose(referenceSpace);
            if (pose && mesh_note) {
              hit = pose.transform.position;
              hitPlane.position.copy(hit);
            }
          }

          if (hit == null) {
            hit = getTouchLocation();
          }

          if (hit) {
            mesh_note.position.copy(hit);
          }
        }
      }
    } else {
      if (rodando_ar === true) {
        remove_note();
        create_note();

        rodando_ar = false;
      }
    }

    renderer.render(scene, camera);
  }
});
