/**
 * Proiect Grafică pe Calculator
 * Student: Jipeanu Viorel
 * Modul: Motor Grafic 3D Three.js & Algoritm LERP (Linear Interpolation)
 * Implementează:
 * - Scenă WebGL 3D cu iluminare PBR în 3 puncte (Key, Fill, Rim Light)
 * - Buclă de randare continuă la 60+ FPS (requestAnimationFrame)
 * - Interpolare liniară continuă (Lerping) invariantă la variațiile de frame-rate
 * - Animații procedurale de repaus (Clipit autonom, Respirație, Micro-pendulare cap)
 */

class GraphicsScene {
    constructor(containerElement) {
        this.container = containerElement;

        // Parametri Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.avatarManager = null;
        this.phonemeEngine = null;

        // Parametri LERP (Interpolare Liniară)
        this.lerpSpeed = 16.0; // Viteză standard pentru tranziții fluide, organice
        this.lerpEnabled = true;

        // Stările curente interpolate ale blendshape-urilor
        this.currentWeights = {};

        // Variabile pentru animații procedurale de repaus (Idle animations)
        this.clock = new THREE.Clock();
        this.lastBlinkTime = 0;
        this.blinkInterval = 3.5; // secunde între clipiri
        this.isBlinking = false;
        this.blinkProgress = 0;

        // Micro-mișcare cap
        this.headSwayEnabled = true;

        this._initScene();
        this._initLighting();
        this._initCameraAndControls();
        this._setupResizeListener();
    }

    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0c0f17); // Fundal Dark Slate/Cyberpunk

        // Grid subtil pe podea pentru adâncime spațială
        const grid = new THREE.GridHelper(20, 20, 0x00f0ff, 0x1f293d);
        grid.position.y = -2.8;
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        this.scene.add(grid);

        // Renderer WebGL cu antialiasing și umbre
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        this.container.appendChild(this.renderer.domElement);
    }

    _initLighting() {
        // 1. Ambient Light subtil
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambientLight);

        // 2. Key Light (Lumină caldă principală cu umbre soft)
        const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        keyLight.position.set(2.5, 4.0, 3.5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.001;
        this.scene.add(keyLight);

        // 3. Fill Light (Lumină de umplere rece din partea opusă)
        const fillLight = new THREE.DirectionalLight(0x7799cc, 0.65);
        fillLight.position.set(-3.0, 1.5, 2.0);
        this.scene.add(fillLight);

        // 4. Rim Light (Contur strălucitor din spate pentru evidențierea siluetei)
        const rimLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
        rimLight.position.set(0.0, 3.0, -3.5);
        this.scene.add(rimLight);
    }

    _initCameraAndControls() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 50);
        this.camera.position.set(0, 0.2, 3.8);

        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 1.5;
            this.controls.maxDistance = 8.0;
            this.controls.target.set(0, 0, 0);
            this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
        }
    }

    _setupResizeListener() {
        window.addEventListener('resize', () => {
            if (!this.container || !this.renderer || !this.camera) return;
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
    }

    /**
     * Conectează managerii de avatar și foneme la scenă
     */
    attachManagers(avatarManager, phonemeEngine) {
        this.avatarManager = avatarManager;
        this.phonemeEngine = phonemeEngine;

        // Inițializăm stările curente cu 0
        this.phonemeEngine.BLENDSHAPES.forEach(key => {
            this.currentWeights[key] = 0.0;
        });
    }

    /**
     * Setează viteza de Lerp din UI
     * @param {number} speed - de ex. între 2.0 (foarte lent) și 40.0 (aproape instant)
     */
    setLerpSpeed(speed) {
        this.lerpSpeed = Math.max(1.0, Math.min(50.0, speed));
    }

    setLerpEnabled(enabled) {
        this.lerpEnabled = enabled;
    }

    /**
     * Bucla principală de animație și randare grafică
     */
    startRenderLoop(onFrameCallback = null) {
        const animate = () => {
            requestAnimationFrame(animate);

            const delta = this.clock.getDelta();
            const elapsedTime = this.clock.getElapsedTime();

            if (this.controls) {
                this.controls.update();
            }

            // 1. Calcul procedural Idle (Clipit și respirație subtilă)
            this._updateIdleAnimations(elapsedTime, delta);

            // 2. Interpolare Liniară (LERP) pe matricea de greutăți faciale
            this._updateBlendshapesLerp(delta);

            // 3. Notificăm interfața cu noile valori dacă e setat callback
            if (onFrameCallback) {
                onFrameCallback(this.currentWeights);
            }

            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    /**
     * Formula Matematică a Interpolării Liniare (LERP) aplicată continuu pe fiecare Blendshape:
     * current = current + (target - current) * factor
     * factor = 1.0 - exp(-lerpSpeed * delta)  [invariant la frame-rate]
     */
    _updateBlendshapesLerp(delta) {
        if (!this.avatarManager || !this.avatarManager.isReady || !this.phonemeEngine) return;

        const targetWeights = this.phonemeEngine.getCurrentTargetWeights();

        // Dacă lerp-ul este activat, aplicăm formula de netezire exponențială
        const lerpFactor = this.lerpEnabled
            ? (1.0 - Math.exp(-this.lerpSpeed * delta))
            : 1.0; // Dacă e dezactivat, trece instant la valoarea țintă (aspect robotic)

        for (const key of this.phonemeEngine.BLENDSHAPES) {
            // Tratament dedicat pentru clipit (răspuns rapid, natural)
            if (key === 'eyeBlinkLeft' || key === 'eyeBlinkRight') {
                const blinkTarget = this.isBlinking ? this.blinkValue : 0.0;
                const currentBlink = this.currentWeights[key] || 0.0;
                const blinkFactor = 1.0 - Math.exp(-30.0 * delta);
                const updatedBlink = currentBlink + (blinkTarget - currentBlink) * blinkFactor;
                this.currentWeights[key] = updatedBlink;
                this.avatarManager.setMorphWeight(key, updatedBlink);
                continue;
            }

            let target = targetWeights[key] || 0.0;
            const current = this.currentWeights[key] || 0.0;
            // Calcul LERP
            const updated = current + (target - current) * lerpFactor;
            this.currentWeights[key] = updated;

            // Transmitem valoarea calculată către modelul 3D
            this.avatarManager.setMorphWeight(key, updated);
        }
    }

    /**
     * Simulare procedurală a comportamentului autonom (clipit uman natural, micro-respirație)
     */
    _updateIdleAnimations(elapsedTime, delta) {
        // Clipit autonom la fiecare 2 - 4 secunde (interval realist uman)
        if (!this.isBlinking && (elapsedTime - this.lastBlinkTime > this.blinkInterval)) {
            this.isBlinking = true;
            this.blinkProgress = 0;
            this.lastBlinkTime = elapsedTime;
            // 25% probabilitate pentru o clipire dublă naturală
            this.isDoubleBlink = Math.random() < 0.25;
            this.blinkPhase = 0;
            this.blinkInterval = 2.0 + Math.random() * 2.8; 
        }

        if (this.isBlinking) {
            // Viteza optimă a arcului de clipire (durată aprox. 240ms)
            this.blinkProgress += delta * 4.4;

            if (this.blinkProgress < 1.0) {
                // Curba de închidere fermă și deschidere fluidă a ochilor
                this.blinkValue = Math.sin(this.blinkProgress * Math.PI);
            } else {
                if (this.isDoubleBlink && this.blinkPhase === 0) {
                    // Declanșare clipire dublă
                    this.blinkPhase = 1;
                    this.blinkProgress = 0;
                } else {
                    this.isBlinking = false;
                    this.blinkValue = 0;
                }
            }
        }

        // Micro-mișcare de respirație și pendulare ușoară a capului (Head Sway)
        if (this.headSwayEnabled && this.avatarManager && this.avatarManager.currentAvatarGroup) {
            const swayGroup = this.avatarManager.currentAvatarGroup;
            // Oscilație subtilă sinusoidală
            swayGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.02;
            swayGroup.rotation.y = Math.sin(elapsedTime * 0.6) * 0.025;
            swayGroup.rotation.x = Math.cos(elapsedTime * 0.8) * 0.015;
        }
    }
}

window.GraphicsScene = GraphicsScene;
