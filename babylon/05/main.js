Bugfender.init({
  appKey: 'akOMxVZb98TxG0lOt8HWKxaEc9D4mqQU',
});

try {
  var engine,
    scene,
    engineMat,
    mats,
    canvas = null;
  let placed,
    placeRequest = false;
  let time = 0;

  // check for webxr session support
  if ("xr" in navigator) {
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      if (supported) {
        //hide "ar-not-supported"
        document.getElementById("ar-not-supported").style.display = "none";
        init();
      }
    });
  }

  const init = async () => {
    canvas = document.getElementById("renderCanvas");

    engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      disableWebGL2Support: false,
    });

    engine.displayLoadingUI();

    scene = new BABYLON.Scene(engine);
    await createScene();

    engine.runRenderLoop(function () {
      if (scene && scene.activeCamera) {
        scene.render();
      }
    });

    // Resize
    window.addEventListener("resize", () => {
      if (!engine) return;
      engine.resize();
    });
  };
} catch (error) {
  Bugfender.log('[babylon 05] - Erro no inicio do main.js: ' + error)
}

const createScene = async () => {
  try {
      const camera = new BABYLON.ArcRotateCamera(
      "camera1",
      2,
      1,
      5,
      new BABYLON.Vector3(0.3, -0.5, 0),
      scene
    );

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    scene.environmenTexture = null;
    // This creates a light
    var light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(-1, 1, 1),
      scene
    );

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.5;

    var xr = await scene.createDefaultXRExperienceAsync({
      uiOptions: {
        sessionMode: "immersive-ar",
      },
      optionalFeatures: true,
    });

    const fm = xr.baseExperience.featuresManager;

    // enable hit test
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest, "latest");

    // enable dom overlay
    const domOverlayFeature = fm.enableFeature(
      BABYLON.WebXRDomOverlay,
      "latest",
      { element: "#overlay" },
      undefined,
      false
    );

    const box = BABYLON.MeshBuilder.CreateBox("cube", { size: 2 }, scene);

    // Create parallax mapping material
    const material = new BABYLON.StandardMaterial("parallaxMaterial", scene);
    material.diffuseTexture = new BABYLON.Texture("public/map_stone.png", scene);
    material.bumpTexture = new BABYLON.Texture("public/normalMap_stone.png", scene);
    material.parallaxScaleBias = 0.1;
    material.useParallax = true;
    material.useParallaxOcclusion = true;
    material.specularPower = 1000.0;
    material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    box.material = material;

    engine.hideLoadingUI();

    engineMat = scene.getMaterialByName("engines");

    //set texture mode to mirror
    engineMat.emissiveTexture.wrapU = BABYLON.Texture.MIRROR_ADDRESSMODE;
    engineMat.emissiveTexture.wrapV = BABYLON.Texture.MIRROR_ADDRESSMODE;
    engineMat.albedoTexture.wrapU = BABYLON.Texture.MIRROR_ADDRESSMODE;
    engineMat.albedoTexture.wrapV = BABYLON.Texture.MIRROR_ADDRESSMODE;

    return scene;
  } catch (error) {
    Bugfender.log('[babylon 05] - Erro em createScene: ' + error)
  }
};
