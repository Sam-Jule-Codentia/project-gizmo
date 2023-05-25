import {WebXRButton} from '/public/webxr/util/webxr-button.js';
import {Scene} from '/public/webxr/render/scenes/scene.js';
import {Renderer, createWebGLContext} from '/public/webxr/render/core/renderer.js';
import {Node} from '/public/webxr/render/core/node.js';
import {Gltf2Node} from '/public/webxr/render/nodes/gltf2.js';
import {DropShadowNode} from '/public/webxr/render/nodes/drop-shadow.js';
import {vec3} from '/public/webxr/render/math/gl-matrix.js';
import {Ray} from '/public/webxr/render/math/ray.js';
import './style.css'

// Gizmo assets
let stereo = '/public/assets/gltf/stereo/stereo.gltf';
let sunflower = '/public/assets/gltf/sunflower/sunflower.gltf';
let space = '/public/assets/gltf/space/space.gltf';

// XR globals.
let xrButton = null;
let xrRefSpace = null;
let xrViewerSpace = null;
let xrHitTestSource = null;

// WebGL scene globals.
let gl = null;
let renderer = null;
let scene = new Scene();
scene.enableStats(false);

let arObject = new Node();
arObject.visible = false;
scene.addNode(arObject);

let reticle = new Gltf2Node({url: '/public/assets/gltf/reticle/reticle.gltf'});
reticle.visible = false;
scene.addNode(reticle);
let reticleHitTestResult = null;

// Having a really simple drop shadow underneath an object helps ground
// it in the world without adding much complexity.
let shadow = new DropShadowNode();
vec3.set(shadow.scale, 0.15, 0.15, 0.15);
arObject.addNode(shadow);

// Ensure the background is transparent for AR.
scene.clear = false;

function initXR() {
xrButton = new WebXRButton({
    onRequestSession: onRequestSession,
    onEndSession: onEndSession,
    textEnterXRTitle: "START AR",
    textXRNotFoundTitle: "AR NOT FOUND",
    textExitXRTitle: "EXIT  AR",
});

document.querySelector('#gizmoSpawnPoint').appendChild(xrButton.domElement);

if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
    xrButton.enabled = supported;
    });
}
}

function onRequestSession() {
return navigator.xr.requestSession('immersive-ar', 
{
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.getElementById("overlay") },
    requiredFeatures: ['local', 'hit-test', 'anchors']
}).then((session) => {
    xrButton.setSession(session);
    onSessionStarted(session);
});
}

function onSessionStarted(session) {
session.addEventListener('end', onSessionEnded);
session.addEventListener('select', onSelect);

if (!gl) {
    gl = createWebGLContext({
    xrCompatible: true
    });

    renderer = new Renderer(gl);

    scene.setRenderer(renderer);
}

session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

// In this sample we want to cast a ray straight out from the viewer's
// position and render a reticle where it intersects with a real world
// surface. To do this we first get the viewer space, then create a
// hitTestSource that tracks it.
session.requestReferenceSpace('viewer').then((refSpace) => {
    xrViewerSpace = refSpace;
    session.requestHitTestSource({ space: xrViewerSpace }).then((hitTestSource) => {
    xrHitTestSource = hitTestSource;
    });
});

session.requestReferenceSpace('local').then((refSpace) => {
    xrRefSpace = refSpace;

    session.requestAnimationFrame(onXRFrame);
});
}

function onEndSession(session) {
anchoredObjects.clear();
xrHitTestSource.cancel();
xrHitTestSource = null;
session.end();
}

function onSessionEnded(event) {
xrButton.setSession(null);
}

// function to get a random gizmo from array
function random_gizmo (randomGizmos)
{
    return randomGizmos[Math.floor(Math.random()*randomGizmos.length)]
}

const MAX_ANCHORED_OBJECTS = 1;
let anchoredObjects = [];
function addAnchoredObjectsToScene(anchor) {
    // array of all gizmos to pick from
    var randomGizmos = [space, stereo, sunflower]

    // select one gizmo
    let gizmoRandomUrl = random_gizmo(randomGizmos); 
let flower = new Gltf2Node({url: gizmoRandomUrl});
scene.addNode(flower);
anchoredObjects.push({
    anchoredObject: flower,
    anchor: anchor
});

// For performance reasons if we add too many objects start
// removing the oldest ones to keep the scene complexity
// from growing too much.
if (anchoredObjects.length > MAX_ANCHORED_OBJECTS) {
    let objectToRemove = anchoredObjects.shift();
    scene.removeNode(objectToRemove.anchoredObject);
    objectToRemove.anchor.delete();
}
}

//subtract fullness by 1 percent every minute
let fullness = 100;
setInterval(function(){
fullness = fullness - 1; console.log(fullness) }, 5000);

//subtract hydration by 1 percent every minute
let hydration = 100;
setInterval(function(){
hydration = hydration - 1; console.log(hydration) }, 3000);

let rayOrigin = vec3.create();
let rayDirection = vec3.create();
function onSelect(event) {
if (reticle.visible) {
    // Create an anchor.
    reticleHitTestResult.createAnchor().then((anchor) => {
    addAnchoredObjectsToScene(anchor);
    }, (error) => {
    console.error("Could not create anchor: " + error);
    });
}
}

// Called every time a XRSession requests that a new frame be drawn.
function onXRFrame(t, frame) {
let session = frame.session;
let pose = frame.getViewerPose(xrRefSpace);

reticle.visible = false;

// If we have a hit test source, get its results for the frame
// and use the pose to display a reticle in the scene.
if (xrHitTestSource && pose) {
    let hitTestResults = frame.getHitTestResults(xrHitTestSource);
    if (hitTestResults.length > 0) {
    let pose = hitTestResults[0].getPose(xrRefSpace);
    reticle.visible = true;
    reticle.matrix = pose.transform.matrix;
    reticleHitTestResult = hitTestResults[0];
    }
}

for (const {anchoredObject, anchor} of anchoredObjects) {
    // only update the object's position if it's still in the list
    // of frame.trackedAnchors
    if (!frame.trackedAnchors.has(anchor)) {
    continue;
    }
    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace);
    anchoredObject.matrix = anchorPose.transform.matrix;
}

scene.startFrame();

session.requestAnimationFrame(onXRFrame);

scene.drawXRFrame(frame, pose);

scene.endFrame();
}

// Start the XR application.
initXR();