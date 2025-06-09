import { ARButton } from './ARButton.js';

// function log(text) {
//   fetch('/log/', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ message: text })
//   }).catch(() => { });
// }

// log('inicio')

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

      this.room = null;
      this.boxes = [];

      this.geometry = new THREE.BoxGeometry();
      this.geometry.deleteAttribute('uv');

      this.roomMaterial = new THREE.MeshStandardMaterial({ metalness: 0, side: THREE.BackSide });
      this.boxMaterial = new THREE.MeshStandardMaterial({ metalness: 0 });

      this.data = neutral_lighting;

      this.setupLights();

      this.createEnvironment();
    }

    setupLights() {
      const mainLight = new THREE.AmbientLight(0xffffff, this.data.topLight.intensity);
      mainLight.position.set(...this.data.topLight.position);
      this.add(mainLight);

      for (const light of this.data.lights) {
          const dirLight = new THREE.DirectionalLight(0xffffff, light.intensity);
          dirLight.position.set(...light.position);
          this.add(dirLight);
      }
    }

    createEnvironment() {
      this.room = new THREE.Mesh(this.geometry, this.roomMaterial);
      this.room.position.set(...this.data.room.position);
      this.room.scale.set(...this.data.room.scale);
      this.room.visible = false;
      this.add(this.room);

      this.boxes = [];
      for (const box of this.data.boxes) {
          const mesh = new THREE.Mesh(this.geometry, this.boxMaterial);
          mesh.position.set(...box.position);
          mesh.rotation.set(0, box.rotation, 0);
          mesh.scale.set(...box.scale);
          mesh.visible = false;
          this.add(mesh);
          this.boxes.push(mesh);
      }
    }

    removeEnvironment() {
      if (this.room) {
          this.remove(this.room);
          this.room.geometry.dispose();
          this.room.material.dispose();
          this.room = null;
      }

      for (const box of this.boxes) {
          this.remove(box);
          box.geometry.dispose();
          box.material.dispose();
      }
      this.boxes = [];
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

  const HIT_ANGLE_DEG = 20;
  let transientHitTestSource = null;
  const ROTATION_SPEED = Math.PI / 90;
  const raycaster = new THREE.Raycaster();
  let inputSource = null;
  let hitPlane = null;
  let interactionWithUI = false;

  let isTranslating = false;
  let isRotating = false;
  let lastDragPosition = null;
  let lastAngle = 0;
  const ROTATION_RATE = 1.5;
  const goalPosition = new THREE.Vector3();
  let controle_log = false;
  let isTwoFingering = false;
  let firstRatio = 0;
  const SCALE_SNAP = 0.05;

  let parametersParallax = null;
  let initialParallaxScale = 1;

  function remove_note() {
    const existingMesh = scene.children.find(child => child.userData.isNoteMesh);
    if (existingMesh) {
      scene.remove(existingMesh);
    }

    const existingPlane = scene.children.find(child => child.userData.isPlaneMesh);
    if (existingPlane) {
      scene.remove(existingPlane);

      hitPlane = null;
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

    // if (possui_instancia) {
    //   remove_note();
    //   return;
    // }

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

    const textureLoader = new THREE.TextureLoader();
    const transparentTexture = textureLoader.load('../examples/image/reticle.png');

    const fator = 1.5;
    hitPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36*fator, 0.24*fator).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: transparentTexture, transparent: true })
      // new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    );
    hitPlane.position.copy(mesh.position);
    hitPlane.quaternion.copy(mesh.quaternion);
    hitPlane.scale.copy(mesh.scale);
    // hitPlane.visible = false;

    hitPlane.userData.isPlaneMesh = true;

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

      parametersParallax = parameters;
      initialParallaxScale = -1.0 * scale;

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
      isRotating = false;
      isTranslating = false;
      lastDragPosition = null;
      controle_log = false;
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

  function scene_getHit(object) {
    const hits = raycaster.intersectObject(object, true);
    return hits.find((hit) => hit.object.visible && !hit.object.userData.noHit);
  }

  function hitPlane_getHit(scene, screenX, screenY) {
    const vector2$1 = new THREE.Vector2(screenX, -screenY);
    // hitPlane.visible = true;
    const hitResult = positionAndNormalFromPoint(vector2$1, hitPlane);
    // hitPlane.visible = false;
    return hitResult == null ? null : hitResult.position;
  }

  function hitPlane_getExpandedHit(scene, screenX, screenY) {
    hitPlane.scale.set(1000, 1000, 1000);
    hitPlane.updateMatrixWorld();
    const hitResult = hitPlane_getHit(scene, screenX, screenY);
    hitPlane.scale.set(1, 1, 1);
    return hitResult;
  }

  function hitFromPoint(ndcPosition, object) {
    raycaster.setFromCamera(ndcPosition, camera);
    return scene_getHit(object);
  }

  function positionAndNormalFromPoint(ndcPosition, object) {
    const hit = hitFromPoint(ndcPosition, object);
    if (hit == null) {
      return null;
    }
    const position = hit.point;
    return {position};
  }

  function getTouchLocation() {
    const { axes } = inputSource.gamepad;
    let location = hitPlane_getExpandedHit(scene, axes[0], axes[1]);
    return location;
  }

  function getFingerSeparationXR(frame, fingers, referenceSpace) {
    const pose1 = frame.getPose(fingers[0].inputSource.targetRaySpace, referenceSpace);
    const pose2 = frame.getPose(fingers[1].inputSource.targetRaySpace, referenceSpace);
  
    if (!pose1 || !pose2) return null;
  
    const dx = pose2.transform.position.x - pose1.transform.position.x;
    const dy = pose2.transform.position.y - pose1.transform.position.y;
    const dz = pose2.transform.position.z - pose1.transform.position.z;
  
    return Math.sqrt(dx * dx + dy * dy + dz * dz) / 10;
    // return Math.sqrt(dx * dx + dy * dy);
  }

  function fingerPolar(fingers) {
    const fingerOne = fingers[0].inputSource.gamepad.axes;
    const fingerTwo = fingers[1].inputSource.gamepad.axes;
    const deltaX = fingerTwo[0] - fingerOne[0];
    const deltaY = fingerTwo[1] - fingerOne[1];
    // const angle = Math.atan2(deltaY, deltaX);
    // let deltaYaw = this.lastAngle - angle;
    // if (deltaYaw > Math.PI) {
    //   deltaYaw -= 2 * Math.PI;
    // }
    // else if (deltaYaw < -Math.PI) {
    //   deltaYaw += 2 * Math.PI;
    // }
    // this.lastAngle = angle;
    return {
      separation: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
      // deltaYaw: deltaYaw
    };
  }

  function setScale(separation) {
    const scale = separation / firstRatio;
    let goalScale = (Math.abs(scale - 1) < SCALE_SNAP) ? 1 : scale;

    if (mesh_note) {
      mesh_note.scale.set(goalScale, goalScale, goalScale);
      hitPlane.scale.set(goalScale, goalScale, goalScale);
      parametersParallax.uniforms['parallaxScale'].value = initialParallaxScale * goalScale; 
    }
  }

  async function render(timestamp, frame) {
    if (frame) {
      if (rodando_ar === false) {
        remove_note();
        rodando_ar = true;

        create_note();
        mesh_note.visible = false;
        hitPlane.visible = false;

        scene.removeEnvironment();
      }

      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      session.addEventListener("selectstart", (event) => {
        if (!transientHitTestSource) {
          return;
        }

        const fingers = frame.getHitTestResultsForTransientInput(transientHitTestSource);

        if (fingers.length === 1) {
          try {
            inputSource = event.inputSource;
            const { axes } = inputSource.gamepad;
            const hitPosition = hitPlane_getHit(scene, axes[0], axes[1]);

            // box.show = true;
            if (hitPosition != null) {
              isTranslating = true;
            }
            else {
              isRotating = true;
              lastAngle = axes[0] * ROTATION_RATE;
            }
          } catch (error) {
            console.log('Erro no processamento do selectstart: ' + error);
          }
        }
        else if (fingers.length === 2) {
            // box.show = true;
            isTwoFingering = true;
            // const { separation } = fingerPolar(fingers);
            const separation = getFingerSeparationXR(frame, fingers, referenceSpace);
            // if (separation) setScale(separation);
            firstRatio = separation / mesh_note.scale.x;
        }
        else {
          // document.getElementById("message-div").textContent = "sem ação";
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
          hitPlane.visible = true;
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

          hitPlane.position.copy(position_from_device);
          hitPlane.quaternion.copy(quaternion_from_device);
          hitPlane.scale.copy(scale_from_device);

          goalPosition.copy(mesh_note.position);

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
        }
      } else if (mesh_note.visible && transientHitTestSource && !interactionWithUI) {
        const fingers = frame.getHitTestResultsForTransientInput(transientHitTestSource);

        if (isTwoFingering) {
          if (fingers.length < 2) {
            isTwoFingering = false;
          }
          else {
            // const {separation} = fingerPolar(fingers);
            // setScale(separation);
            const separation = getFingerSeparationXR(frame, fingers, referenceSpace);
            if (separation) setScale(separation);
            // try {
            //   if (separation) setScale(separation);
            // } catch (error) {
            //   log("Error setting scale: " + error);
            // }
          }
        }
        else if (fingers.length === 2) {
          isTranslating = false;
          isRotating = false;
          isTwoFingering = true;
          // const { separation } = fingerPolar(fingers);
          const separation = getFingerSeparationXR(frame, fingers, referenceSpace);
          // if (separation) setScale(separation);
          firstRatio = separation / mesh_note.scale.x;
        }
        else if (isRotating) {
          const angle = inputSource.gamepad.axes[0] * ROTATION_RATE;
          mesh_note.rotateY(angle - lastAngle);
          hitPlane.rotateY(angle - lastAngle);
          lastAngle = angle;
        } else if (isTranslating) {
          try {
            if (fingers.length == 1) {
              let finger = fingers[0];
              let hit = null;
              let oldPlane = false;

              if (finger.results.length > 0) {
                const pose = finger.results[0].getPose(referenceSpace);
                if (pose && mesh_note) {
                  hit = pose.transform.position;
                  if (hit) {
                    oldPlane = false;
                  }
                }
              }

              if (hit == null) {
                hit = getTouchLocation();
                if (hit) {
                  oldPlane = true;
                }
              }

              if (hit && !lastDragPosition) {
                lastDragPosition = new THREE.Vector3();
                lastDragPosition.copy(hit);
              }

              if (hit) {
                  const diff = new THREE.Vector3();
                  diff.copy(hit);
                  diff.sub(lastDragPosition);

                  if (oldPlane) {
                    diff.y = 0;
                  }

                  goalPosition.add(diff);
                  lastDragPosition.copy(hit);

                  mesh_note.position.copy(goalPosition);
                  hitPlane.position.copy(goalPosition);
              }
            }
          } catch (error) {
            console.log("Error updating note position:" + error);
          }
        }
      }
    } else {
      if (rodando_ar === true) {
        remove_note();
        create_note();

        scene.createEnvironment();

        rodando_ar = false;
      }
    }

    renderer.render(scene, camera);
  }
});
