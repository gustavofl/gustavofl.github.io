document.addEventListener('DOMContentLoaded', async function () {
    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true);

    const createScene = async function () {
        const scene = new BABYLON.Scene(engine);

        const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);

        // Adjust zoom settings
        camera.wheelPrecision = 50; // Decrease zoom intensity
        camera.lowerRadiusLimit = 1; // Minimum zoom distance
        camera.upperRadiusLimit = 10; // Maximum zoom distance

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        const box = BABYLON.MeshBuilder.CreateBox("cube", { size: 2 }, scene);

        // Create parallax mapping material
        const material = new BABYLON.StandardMaterial("parallaxMaterial", scene);
        material.diffuseTexture = new BABYLON.Texture("../images/map_stone.png", scene);
        // material.bumpTexture = new BABYLON.Texture("../images/normalMap_stone.png", scene);
        // material.parallaxScaleBias = 0.1;
        // material.useParallax = true;
        // material.useParallaxOcclusion = true;
        // material.specularPower = 1000.0;
        // material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);

        box.material = material;

        // Initialize WebXR
        const xr = await scene.createDefaultXRExperienceAsync({
            // ask for an ar-session
            uiOptions: {
                sessionMode: "immersive-ar",
            },
        });

        return scene;
    };

    const scene = await createScene();

    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener('resize', function () {
        engine.resize();
    });
});
