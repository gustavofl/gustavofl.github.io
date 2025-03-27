Bugfender.init({
	appKey: 'akOMxVZb98TxG0lOt8HWKxaEc9D4mqQU',
	// overrideConsoleMethods: true,
	// printToConsole: true,
	// registerErrorHandler: true,
	// logBrowserEvents: true,
	// logUIEvents: true,
	// version: '',
	// build: '',
});

import { ARButtonCustom } from './ARButtonCustom.js';

const TEXT_DEFAULT = "";
const TEXT_RECOGNIZE_SURFACE = "Movimente o dispositivo para reconhecer uma superfície.";
const TEXT_RENDER_OBJECT = "Clique na tela para posicionar o notebook na área demarcada.";
const TEXT_REPOSITION_OBJECT = "Clique na tela para reposicionar o notebook.";
const TEXT_LOADING_MODEL = "Carregando modelo 3D ...";
const TEXT_START_AR = "Iniciar Realidade Aumentada";

// const importmap = document.createElement("script");
// importmap.type = "importmap";
// importmap.innerHTML = `
//     {
//         "imports": {
//             "three": "https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.module.js",
//             "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.173.0/examples/jsm/"
//         }
//     }
// `

// document.head.appendChild(importmap);

const modelViewer = document.querySelector("model-viewer");

const div = document.createElement("div");
div.id = "canvas-model-viewer";
div.setAttribute("slot", "canvas");

modelViewer.appendChild(div);

window.addEventListener('load', async () => {
    const THREE = await import('three');
    const GLTFLoaderModule = await import('three/addons/loaders/GLTFLoader.js');
    const GLTFLoader = GLTFLoaderModule.GLTFLoader;

    class ThreeJSRenderer {

        constructor() {
            var container = document.querySelector("div#canvas-model-viewer");

            this.using_ar = false;
            this.notebook_ar_visible = false;

            this.notebook_dimensions = [0.35,0.25]; // valores padrao

            this.model_viewer_camera_data = null;

            this.camera_threejs = new THREE.PerspectiveCamera(
                modelViewer.getFieldOfView(), 
                modelViewer.clientWidth / modelViewer.clientHeight, 
                0.01, 
                10 
            );
            this.camera_threejs.position.z = 2;

            this.scene = new THREE.Scene();

            this.renderer = new THREE.WebGLRenderer( { antialias: true } );
            this.renderer.setSize( modelViewer.clientWidth, modelViewer.clientHeight );
            this.renderer.setClearColor(0xFFFFFF); // Set background color to gray
            this.renderer.setAnimationLoop( animate_ar );
            this.renderer.xr.enabled = true;
            this.renderer.gammaInput = true;
            this.renderer.gammaOutput = true;
            container.appendChild( this.renderer.domElement );

            const overlay = this.createOverlayAR();

            this.arButton = ARButtonCustom.createButton(
                this.renderer, 
                { 
                    requiredFeatures: ['hit-test', 'dom-overlay'],
                    domOverlay: {root: overlay}
                }
            );
            this.arButton.disabled = true;
            document.body.appendChild(this.arButton);

            for (let x = -1; x < 2; x+=2) {
                for (let y = -1; y < 2; y+=2) {
                    for (let z = -1; z < 2; z+=2) {
                        const light = new THREE.DirectionalLight(0xffffff, 1);
                        light.position.set(x*2,y*2,z*2).normalize();
                        this.scene.add(light);
                    }
                }    
            }

			this.hitTestSource = null;
			this.hitTestSourceRequested = false;

            // Circulo de referencia (opcional)

            this.object_instance = null;

            this.reticle = null;
            this.updateReticleGeometry();

            const threeJSRenderer = this;

            function onSelect() {
                if ( threeJSRenderer.notebook_ar_visible ) {
                    if (threeJSRenderer.object_instance) {
                        threeJSRenderer.scene.remove(threeJSRenderer.object_instance);
                        threeJSRenderer.object_instance = null;
                    }

                    threeJSRenderer.notebook_ar_visible = false;
                }
                else {
                    if ( threeJSRenderer.reticle.visible ) {
                        threeJSRenderer.carregar_glb(modelViewer.src, threeJSRenderer.reticle.matrix);

                        threeJSRenderer.notebook_ar_visible = true;
                    }
                }
            }

            this.controller = this.renderer.xr.getController( 0 );
            this.controller.addEventListener( 'select', onSelect );
            this.scene.add( this.controller );

        }

        createOverlayAR() {
            const overlay = document.createElement( 'div' );
            overlay.style.display = 'none';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            document.body.appendChild( overlay );

            const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
            svg.setAttribute( 'width', 38 );
            svg.setAttribute( 'height', 38 );
            svg.style.position = 'absolute';
            svg.style.right = '20px';
            svg.style.top = '20px';
            svg.addEventListener( 'click', function () {
                threeJSRenderer.renderer.xr.getSession().end();
            } );
            overlay.appendChild( svg );

            const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
            path.setAttribute( 'd', 'M 12,12 L 28,28 M 28,12 12,28' );
            path.setAttribute( 'stroke', '#fff' );
            path.setAttribute( 'stroke-width', 2 );
            svg.appendChild( path );

            const message = document.createElement('div');
            message.id = 'message_ar';
            message.innerHTML = TEXT_DEFAULT;
            message.style.position = 'absolute';
            message.style.margin = 'auto';
            message.style.bottom = '40px';
            message.style.display = 'block';
            message.style.textAlign = 'center';
            message.style.backgroundColor = '#fff';
            message.style.padding = '10px';
            message.style.borderRadius = '10px';
            message.style.maxWidth = '50%';
            message.style.left = '50%';
            message.style.transform = 'translate(-50%, 0)';
            overlay.appendChild(message);

            return overlay;
        }

        change_message_ar(new_text) {
            const message = document.getElementById('message_ar');
            message.innerHTML = new_text;
        }

        // change_button_ar_text(new_text) {
        //     const button_ar = document.getElementById('ARButton');
        //     button_ar.innerHTML = new_text;
        // }

        /**
         * Simula o carregamento de recursos e chama o progressCallback com o progresso.
         * Retorna uma Promise que resolve com um objeto FramingInfo.
         * @param {function} progressCallback - Função de callback para reportar o progresso.
         * @returns {Promise<FramingInfo>}
         */
        async load(progressCallback) {
            // Simula um carregamento assíncrono
            for (let i = 0; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Simula um atraso
                progressCallback(i); // Reporta o progresso
            }

            // Retorna um objeto FramingInfo simulado
            return {
            frameWidth: 1920,
            frameHeight: 1080,
            aspectRatio: 16 / 9,
            };
        }

        /**
         * Renderiza a cena com base na câmera fornecida.
         * @param {Camera} camera - Objeto que representa a câmera.
         */
        render(camera) {
            this.model_viewer_camera_data = camera;
        }

        render_three_js() {
            if (!this.model_viewer_camera_data) {
                return;
            }

            // Cria uma instância de THREE.Matrix4 a partir da view matrix
            const matrix = new THREE.Matrix4().fromArray(this.model_viewer_camera_data.viewMatrix);

            // Cria objetos para armazenar posição, quaternion e escala
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();

            // Decompõe a matriz em posição, quaternion e escala
            matrix.decompose(position, quaternion, scale);

            this.camera_threejs.position['x'] = position['x']
            this.camera_threejs.position['y'] = position['y']
            this.camera_threejs.position['z'] = position['z']

            this.camera_threejs.quaternion['_x'] = quaternion['_x']
            this.camera_threejs.quaternion['_y'] = quaternion['_y']
            this.camera_threejs.quaternion['_z'] = quaternion['_z']
            this.camera_threejs.quaternion['_w'] = quaternion['_w']

            this.camera_threejs.scale['x'] = scale['x']
            this.camera_threejs.scale['y'] = scale['y']
            this.camera_threejs.scale['z'] = scale['z']

            this.camera_threejs.projectionMatrix.fromArray(this.model_viewer_camera_data.projectionMatrix)

            this.renderer.render( this.scene, this.camera_threejs );
        }

        /**
         * Ajusta o tamanho do renderizador.
         * @param {number} width - Nova largura.
         * @param {number} height - Nova altura.
         */
        resize(width, height) {
            if (! this.renderer.xr.isPresenting) {
                this.camera_threejs.aspect = width / height;
                this.camera_threejs.updateProjectionMatrix();
    
                this.renderer.setSize( width, height );
            }

        }

        texture_from_glb(gltf, index_texture) {
            var indice_imagem = gltf.parser.json.textures[index_texture].source;

            // Bugfender.log(indice_imagem)
            
            const image = gltf.parser.json.images[indice_imagem];

            // Bugfender.log(image)
    
            // Extraia os dados binários do bufferView
            const bufferView = gltf.parser.json.bufferViews[image.bufferView];
            const buffer = gltf.parser.extensions.KHR_binary_glTF.body;

            // Bugfender.log(bufferView)
            // Bugfender.log(buffer)

            // Crie um array de bytes (Uint8Array) a partir dos dados binários
            const byteOffset = bufferView.byteOffset || 0;
            const byteLength = bufferView.byteLength;
            const imageData = new Uint8Array(buffer, byteOffset, byteLength);

            // Bugfender.log(imageData)

            // Crie um Blob a partir dos dados binários
            const blob = new Blob([imageData], { type: image.mimeType });

            // Crie uma URL temporária para o Blob
            const imageUrl = URL.createObjectURL(blob);

            // Bugfender.log(imageUrl)

            // Carregue a textura usando THREE.TextureLoader
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(imageUrl);
            texture.flipY = false;

            // Bugfender.log(texture)

            return texture;
        }

        carregar_glb(caminho_arquivo, matrix=null) {
            this.change_message_ar(TEXT_LOADING_MODEL);

            const loader = new GLTFLoader();

            const threeJSRenderer = this;

            // this.change_button_ar_text(TEXT_LOADING_MODEL);
            this.arButton.disabled = true;
            this.arButton.style.background = 'rgba(150, 150, 150)';

            loader.load(
                caminho_arquivo, // Caminho para o arquivo GLB
                async function (gltf) {
                    const model = gltf.scene;

                    let obj = gltf['parser']['json']

                    Bugfender.log(obj);
                    Bugfender.log(JSON.stringify(obj));

                    model.traverse(function(child) {
                        try {
                            if(child.isMesh && child.material.userData.parallaxMapping) {
                                var parallaxConfig = child.material.userData.parallaxMapping;

                                Bugfender.log("Iniciando a criação do ShaderMaterial")

                                var bumpMapTexture = threeJSRenderer.texture_from_glb(gltf, parallaxConfig.index_texture);
                                var mapTexture = new THREE.CanvasTexture( child.material.map.source.data );

                                const material_parallax = threeJSRenderer.gerar_material_parallax(
                                    mapTexture, 
                                    bumpMapTexture, 
                                    parallaxConfig.scale, 
                                    parallaxConfig.minLayers, 
                                    parallaxConfig.maxLayers,
                                );

                                child.material = material_parallax;

                                Bugfender.log("ShaderMaterial aplicado")
                            }
                        } catch (error) {
                            Bugfender.log('try/catch carregar_glb:')
                            Bugfender.log(error)
                        }
                    })

                    if (matrix) {
                        matrix.decompose(model.position, model.quaternion, model.scale);
                    }

                    if (threeJSRenderer.object_instance) {
                        threeJSRenderer.scene.remove(threeJSRenderer.object_instance);
                    }

                    threeJSRenderer.object_instance = model;

                    threeJSRenderer.scene.add(threeJSRenderer.object_instance);

                    // Calcula o bounding box do modelo
                    const boundingBox = new THREE.Box3().setFromObject(model);

                    // Obtém as dimensões do bounding box
                    const size = new THREE.Vector3();
                    boundingBox.getSize(size);

                    threeJSRenderer.notebook_dimensions = [size.x,size.z]

                    threeJSRenderer.change_message_ar(TEXT_REPOSITION_OBJECT);
                    // threeJSRenderer.change_button_ar_text(TEXT_START_AR);
                    threeJSRenderer.arButton.disabled = false;
                    threeJSRenderer.arButton.style.background = 'rgba(13, 78, 255)';

                    Bugfender.log("arquivo GLB carregado")
                },
                function (xhr) {
                    // fazer nada
                },
                function (error) {
                    console.error('Erro ao carregar o modelo:', error);
                }
            );
        }

        gerar_material_parallax(texture_color, texture_height, scale, minLayers, maxLayers) {
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

        removeReticle() {
            if ( this.reticle ) {
                this.scene.remove(this.reticle);
                this.reticle.geometry.dispose();
                this.reticle.material.dispose();
            }
        }

        updateReticleGeometry() {
            var width = this.notebook_dimensions[0];
            var height = this.notebook_dimensions[1];

            // Cria uma nova geometria com as dimensões corretas
            this.reticle = new THREE.Mesh(
                new THREE.PlaneGeometry(width, height).rotateX(-Math.PI / 2),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.5
                })
            );
            this.reticle.matrixAutoUpdate = false;
            this.reticle.visible = false;
            this.scene.add(this.reticle);
        }
    }

    var threeJSRenderer = new ThreeJSRenderer();
    modelViewer.registerRenderer(threeJSRenderer);

    function animate_ar(timestamp, frame) {
        Bugfender.log('iniciou animate_ar')

        try {
            if ( frame ) {

                Bugfender.log('frame = true')

                const referenceSpace = threeJSRenderer.renderer.xr.getReferenceSpace();
                const session = threeJSRenderer.renderer.xr.getSession();

                if ( threeJSRenderer.hitTestSourceRequested === false ) {
                    session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpace ) {
                        session.requestHitTestSource( { space: referenceSpace } ).then( function ( source ) {
                            threeJSRenderer.hitTestSource = source;
                        } );
                    } );
                    session.addEventListener( 'end', function () {
                        threeJSRenderer.hitTestSourceRequested = false;
                        threeJSRenderer.hitTestSource = null;
                    } );
                    threeJSRenderer.hitTestSourceRequested = true;
                }

                Bugfender.log('passou pelo if do hitTestSource')

                if ( ! threeJSRenderer.using_ar ) {
                    threeJSRenderer.scene.remove(threeJSRenderer.object_instance);
                    threeJSRenderer.updateReticleGeometry();

                    Bugfender.log('mudou para com AR');
                }

                threeJSRenderer.using_ar = true;

                Bugfender.log('threeJSRenderer.using_ar = true')

                // Desenha um circulo de referencia (opcional)

                if ( threeJSRenderer.hitTestSource ) {
                    const hitTestResults = frame.getHitTestResults( threeJSRenderer.hitTestSource );
                    if ( hitTestResults.length && ! threeJSRenderer.notebook_ar_visible ) {
                        const hit = hitTestResults[ 0 ];
                        threeJSRenderer.reticle.visible = true;
                        threeJSRenderer.reticle.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix );

                        threeJSRenderer.change_message_ar(TEXT_RENDER_OBJECT);
                    } else {
                        threeJSRenderer.reticle.visible = false;

                        if ( ! threeJSRenderer.notebook_ar_visible ) {
                            threeJSRenderer.change_message_ar(TEXT_RECOGNIZE_SURFACE);
                        }
                    }
                }

                Bugfender.log('passou pelo if da atualização do reticle')

            }

            else {

                Bugfender.log('frame = false')

                if ( threeJSRenderer.using_ar && ! threeJSRenderer.renderer.xr.isPresenting ) {
                    threeJSRenderer.scene.remove(threeJSRenderer.object_instance);
                    threeJSRenderer.object_instance = null;

                    threeJSRenderer.using_ar = false;

                    Bugfender.log('mudou para sem AR');
                }

                Bugfender.log('passou pelo if da finalização do AR')

                if (threeJSRenderer.object_instance == null) {
                    threeJSRenderer.object_instance = 1;
                    threeJSRenderer.carregar_glb(modelViewer.src);
                }

                Bugfender.log('carregou glb no modo web')
            }
        } catch (error) {
			Bugfender.log('try/catch animate_ar:')
			Bugfender.log(error)
        }

        Bugfender.log('chamando a renderização do threejs')

        threeJSRenderer.render_three_js();
    }
});