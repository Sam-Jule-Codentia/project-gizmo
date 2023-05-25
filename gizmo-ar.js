import { WebXRButton } from '/public/webxr/util/webxr-button.js';
import { Scene } from '/public/webxr/render/scenes/scene.js';
import { Renderer, createWebGLContext } from '/public/webxr/render/core/renderer.js';
import { Node } from '/public/webxr/render/core/node.js';
import { Gltf2Node } from '/public/webxr/render/nodes/gltf2.js';
import { DropShadowNode } from '/public/webxr/render/nodes/drop-shadow.js';
import { vec3 } from '/public/webxr/render/math/gl-matrix.js';
import { Ray } from '/public/webxr/render/math/ray.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css'
'/public/assets/scene.glb'
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

// Gizmo assets
let stereo = '/public/assets/gltf/stereo/stereo.gltf';
let sunflower = '/public/assets/gltf/sunflower/sunflower.gltf';
let space = '/public/assets/gltf/space/space.gltf';
let container;
let controller;
let camera, scene, renderer;

let reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;

init();
animate();

function init() {

    container = document.createElement('div');
    container.classList.add("d-none");
    document.getElementById("gizmoSpawnPoint").appendChild(container);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    //

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    //

    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.getElementById("overlay") } }));
    document.getElementById("ARButton").addEventListener('click', (e) => {
        container.classList.remove("d-none");
    })
    //

    const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0);

    function onSelect() {

        if (reticle.visible) {
            var loader = new GLTFLoader();
            // function to get a random gizmo from array
            function random_gizmo(randomGizmos) {
                return randomGizmos[Math.floor(Math.random() * randomGizmos.length)]
            }

            var randomGizmos = [space, stereo, sunflower]
            let gizmoRandomUrl = random_gizmo(randomGizmos)
            if (scene.children.length > 2) {
                scene.remove(scene.children[3])
            }
            console.log(scene.children)


            loader.load(
                // resource URL
                gizmoRandomUrl,
                // called when the resource is loaded

                function (gltf) {

                    gltf.scene.traverse(function (object) {

                        if (object.isMesh) {
                            object.matrix.copyPosition(reticle.matrix)
                            object.position.set(reticle.position.x, reticle.position.y, reticle.position.z)
                            console.log(object.position)
                        }

                    });

                    scene.add(gltf.scene)
                    console.log(reticle.matrix)
                    scene.children[3].position.setFromMatrixPosition(reticle.matrix)

                    gltf.animations; // Array<THREE.AnimationClip>
                    gltf.scene; // THREE.Group
                    gltf.scenes; // Array<THREE.Group>
                    gltf.cameras; // Array<THREE.Camera>
                    gltf.asset; // Object

                },
                // called while loading is progressing
                function (xhr) {

                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');

                },
                // called when loading has errors
                function (error) {

                    console.log('An error happened');

                }
            );

        }

    }

    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);


    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(- Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // * hunger meter process
    var hunger = document.getElementById("hungerBar");
    var width = 100;
    hunger.dataset.width = width;

    setInterval (() => {
        var width = parseInt(hunger.dataset.width);
        width--;
        hunger.style.width = width + "%";
        hunger.dataset.width = width;
    }, 5000)

    // * hydration meter process
    var hydration = document.getElementById("hydrationBar");
    var width = 100;
    hydration.dataset.width = width;

    setInterval (() => {
        var width = parseInt(hydration.dataset.width);
        width--;
        hydration.style.width = width + "%";
        hydration.dataset.width = width;
    }, 3000)

    window.addEventListener('resize', onWindowResize);

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

//

function animate() {

    renderer.setAnimationLoop(render);

}

function render(timestamp, frame) {

    if (frame) {

        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {

            session.requestReferenceSpace('viewer').then(function (referenceSpace) {

                session.requestHitTestSource({ space: referenceSpace }).then(function (source) {

                    hitTestSource = source;

                });

            });

            session.addEventListener('end', function () {

                hitTestSourceRequested = false;
                hitTestSource = null;

            });

            hitTestSourceRequested = true;

        }

        if (hitTestSource) {

            const hitTestResults = frame.getHitTestResults(hitTestSource);

            if (hitTestResults.length) {

                const hit = hitTestResults[0];

                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);

            } else {

                reticle.visible = false;

            }

        }

    }

    renderer.render(scene, camera);

}