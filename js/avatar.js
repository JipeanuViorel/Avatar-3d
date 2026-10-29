/**
 * Proiect Grafică pe Calculator
 * Student: Jipeanu Viorel
 * Modul: Gestiune Model 3D & Morph Targets (Apple ARKit Standard)
 * Include:
 * 1. Generator Procedural 3D de geometrie facială cu morph attributes pentru 12 blendshapes ARKit.
 * 2. Încărcător GLTF/GLB pentru modele externe (Ready Player Me, Blender) cu indexare automată ARKit.
 */

class AvatarManager {
    constructor(scene) {
        this.scene = scene;
        this.currentAvatarGroup = new THREE.Group();
        this.scene.add(this.currentAvatarGroup);

        this.targetMeshes = []; // Toate mesh-urile ce conțin morph targets
        this.blendshapeMap = {}; // Mapare de la nume standard ARKit la index intern
        this.isReady = false;
        this.avatarType = 'procedural'; // 'procedural' sau 'glb'

        // Părți anatomice procedurale (ochi, sprâncene, cap)
        this.leftBrow = null;
        this.rightBrow = null;
        this.leftEyelid = null;
        this.rightEyelid = null;
    }

    /**
     * Construiește avatarul procedural 3D direct în Three.js cu Morph Targets ARKit
     */
    buildProceduralAvatar() {
        this.clear();
        this.avatarType = 'procedural';

        const headGroup = new THREE.Group();

        // 1. Geometrie sferică subdivizată pentru capul stilizat
        // 48 segmente pe lățime și înălțime pentru rezoluție adecvată a deformațiilor faciale
        const radius = 1.35;
        const widthSegments = 48;
        const heightSegments = 48;
        const baseGeometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);

        // Alungim ușor sfera pe verticală și aplatizăm puțin profilul pentru a semăna cu un cap uman
        const pos = baseGeometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i);
            let y = pos.getY(i);
            let z = pos.getZ(i);

            // Alungire maxilar / bărbie
            if (y < 0) {
                y *= 1.25;
                if (z > 0) {
                    x *= 0.88; // maxilar mai conic
                }
            } else {
                y *= 1.1;
            }

            pos.setXYZ(i, x, y, z);
        }
        baseGeometry.computeVertexNormals();

        // 2. Crearea Morph Targets (Blendshapes) ARKit pe baza geometriei de bază
        const morphPositions = {};
        const blendshapeNames = [
            'jawOpen',
            'mouthClose',
            'mouthFunnel',
            'mouthPucker',
            'mouthSmileLeft',
            'mouthSmileRight',
            'mouthStretchLeft',
            'mouthStretchRight',
            'mouthShrugLower',
            'browInnerUp',
            'eyeBlinkLeft',
            'eyeBlinkRight'
        ];

        // Inițializăm array-urile de poziții pentru fiecare morph target
        blendshapeNames.forEach(name => {
            morphPositions[name] = new Float32Array(pos.array.length);
            // Copiem pozițiile originale ca punct de pornire
            morphPositions[name].set(pos.array);
        });

        // Aplicăm deformații matematice pe coordonatele vârfurilor din zona gurii, ochilor și sprâncenelor
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const idx3 = i * 3;

            // Mască pentru zona gurii (y între -1.1 și -0.3, z > 0.4)
            const isMouthArea = (y > -1.2 && y < -0.2 && z > 0.4);
            const isLowerJaw = (y < -0.45 && z > 0.2);
            const isUpperLip = (y >= -0.55 && y < -0.35 && z > 0.6);
            const isLowerLip = (y >= -0.85 && y < -0.55 && z > 0.6);
            const isLeftCorner = (x < -0.35 && x > -0.8 && y > -0.75 && y < -0.45 && z > 0.4);
            const isRightCorner = (x > 0.35 && x < 0.8 && y > -0.75 && y < -0.45 && z > 0.4);

            // 1. jawOpen (Deschide maxilarul inferior în jos și puțin înapoi)
            if (isLowerJaw) {
                const factor = Math.min(1.0, Math.max(0.0, (-y - 0.45) / 0.8));
                morphPositions['jawOpen'][idx3 + 1] = y - 0.55 * factor; // Coborâre Y
                morphPositions['jawOpen'][idx3 + 2] = z - 0.12 * factor; // Retracție Z
            }

            // 2. mouthClose (Apropie buzele)
            if (isLowerLip) {
                morphPositions['mouthClose'][idx3 + 1] = y + 0.14; // Ridică buza inferioară
            }
            if (isUpperLip) {
                morphPositions['mouthClose'][idx3 + 1] = y - 0.08; // Coboară buza superioară
            }

            // 3. mouthFunnel (Deschidere rotundă în formă de pâlnie / O)
            if (isMouthArea) {
                const distFromCenter = Math.sqrt(x * x + (y + 0.6) * (y + 0.6));
                const factor = Math.max(0.0, 1.0 - distFromCenter / 0.65);
                morphPositions['mouthFunnel'][idx3 + 2] = z + 0.22 * factor; // Avansare buze
                morphPositions['mouthFunnel'][idx3] = x * (1.0 - 0.35 * factor); // Strângere orizontală
            }

            // 4. mouthPucker (Buze strânse, aduse puternic în față / OO / W)
            if (isMouthArea) {
                const dist = Math.sqrt(x * x + (y + 0.6) * (y + 0.6));
                const factor = Math.max(0.0, 1.0 - dist / 0.6);
                morphPositions['mouthPucker'][idx3 + 2] = z + 0.38 * factor; // Pucker pronunțat
                morphPositions['mouthPucker'][idx3] = x * (1.0 - 0.55 * factor);
            }

            // 5. mouthSmileLeft & mouthSmileRight (Zâmbet / întindere supero-laterală)
            if (isLeftCorner) {
                morphPositions['mouthSmileLeft'][idx3 + 1] = y + 0.22; // Ridicare colț stâng
                morphPositions['mouthSmileLeft'][idx3] = x - 0.15;     // Întindere stânga
                morphPositions['mouthSmileLeft'][idx3 + 2] = z - 0.08;
            }
            if (isRightCorner) {
                morphPositions['mouthSmileRight'][idx3 + 1] = y + 0.22; // Ridicare colț drept
                morphPositions['mouthSmileRight'][idx3] = x + 0.15;     // Întindere dreapta
                morphPositions['mouthSmileRight'][idx3 + 2] = z - 0.08;
            }

            // 6. mouthStretchLeft & mouthStretchRight (Întindere pur orizontală a gurii)
            if (isLeftCorner) {
                morphPositions['mouthStretchLeft'][idx3] = x - 0.25;
            }
            if (isRightCorner) {
                morphPositions['mouthStretchRight'][idx3] = x + 0.25;
            }

            // 7. mouthShrugLower (Buza inferioară urcă peste dinții superiori - F / V)
            if (isLowerLip) {
                morphPositions['mouthShrugLower'][idx3 + 1] = y + 0.28;
                morphPositions['mouthShrugLower'][idx3 + 2] = z + 0.12;
            }

            // 8. browInnerUp (Sprâncene interioare ridicate)
            if (y > 0.45 && y < 0.95 && Math.abs(x) < 0.55 && z > 0.8) {
                const factor = Math.max(0.0, 1.0 - Math.abs(x) / 0.55);
                morphPositions['browInnerUp'][idx3 + 1] = y + 0.20 * factor;
            }

            // 9. eyeBlinkLeft & eyeBlinkRight (Clipire pleoape)
            if (y > 0.15 && y < 0.65 && z > 0.85) {
                if (x < -0.2 && x > -0.85) {
                    morphPositions['eyeBlinkLeft'][idx3 + 1] = y - 0.18;
                }
                if (x > 0.2 && x < 0.85) {
                    morphPositions['eyeBlinkRight'][idx3 + 1] = y - 0.18;
                }
            }
        }

        // Atribuim morphAttributes la geometrie
        baseGeometry.morphAttributes.position = [];
        blendshapeNames.forEach(name => {
            const attr = new THREE.BufferAttribute(morphPositions[name], 3);
            attr.name = name;
            baseGeometry.morphAttributes.position.push(attr);
        });

        // Material PBR stilizat (Cyberpunk / Modern Stylized)
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x223344,
            roughness: 0.35,
            metalness: 0.65,
            flatShading: false
        });

        this.headMesh = new THREE.Mesh(baseGeometry, headMaterial);
        this.headMesh.castShadow = true;
        this.headMesh.receiveShadow = true;

        // Dicționar de morph targets
        this.headMesh.morphTargetDictionary = {};
        this.headMesh.morphTargetInfluences = [];
        blendshapeNames.forEach((name, idx) => {
            this.headMesh.morphTargetDictionary[name] = idx;
            this.headMesh.morphTargetInfluences.push(0.0);
        });

        headGroup.add(this.headMesh);

        // 3. Adăugăm ochi expresivi cu pupile și accente luminoase
        const eyeGeo = new THREE.SphereGeometry(0.24, 24, 24);
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x005577,
            roughness: 0.1,
            metalness: 0.8
        });

        this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.leftEye.position.set(-0.48, 0.38, 1.15);
        headGroup.add(this.leftEye);

        this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.rightEye.position.set(0.48, 0.38, 1.15);
        headGroup.add(this.rightEye);

        // Pupile interioare negre
        const pupilGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(0, 0, 0.18);
        this.leftEye.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0, 0, 0.18);
        this.rightEye.add(rightPupil);

        // Pleoape superioare procedurale pentru clipit vizibil și realist
        const eyelidGeo = new THREE.SphereGeometry(0.26, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
        const eyelidMat = new THREE.MeshStandardMaterial({
            color: 0x1b2735,
            roughness: 0.35,
            metalness: 0.6
        });

        this.leftEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
        this.leftEyelid.position.set(-0.48, 0.40, 1.16);
        this.leftEyelid.scale.set(1.05, 0.05, 1.05);
        this.leftEyelid.rotation.x = -0.22;
        headGroup.add(this.leftEyelid);

        this.rightEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
        this.rightEyelid.position.set(0.48, 0.40, 1.16);
        this.rightEyelid.scale.set(1.05, 0.05, 1.05);
        this.rightEyelid.rotation.x = -0.22;
        headGroup.add(this.rightEyelid);

        // 4. Sprâncene stilizate
        const browGeo = new THREE.BoxGeometry(0.45, 0.08, 0.1);
        const browMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x003344 });

        this.leftBrow = new THREE.Mesh(browGeo, browMat);
        this.leftBrow.position.set(-0.52, 0.72, 1.18);
        this.leftBrow.rotation.z = 0.08;
        headGroup.add(this.leftBrow);

        this.rightBrow = new THREE.Mesh(browGeo, browMat);
        this.rightBrow.position.set(0.52, 0.72, 1.18);
        this.rightBrow.rotation.z = -0.08;
        headGroup.add(this.rightBrow);

        // 5. Contur buze vizibil pentru evidențierea articulației fonetice
        const mouthRimGeo = new THREE.TorusGeometry(0.28, 0.045, 16, 32);
        const mouthRimMat = new THREE.MeshStandardMaterial({
            color: 0xff0077,
            emissive: 0x660033,
            roughness: 0.3
        });
        this.mouthRim = new THREE.Mesh(mouthRimGeo, mouthRimMat);
        this.mouthRim.position.set(0, -0.6, 1.25);
        this.mouthRim.scale.set(1.4, 0.6, 1.0);
        headGroup.add(this.mouthRim);

        this.currentAvatarGroup.add(headGroup);

        // Înregistrăm mesh-ul țintă
        this.targetMeshes = [this.headMesh];
        this._buildBlendshapeMap();
        this.isReady = true;

        console.log('Avatar procedural 3D inițializat cu succes. ARKit Morph Targets active:', Object.keys(this.headMesh.morphTargetDictionary));
    }

    /**
     * Încarcă un model extern GLTF/GLB (de ex. Ready Player Me sau export ARKit)
     * @param {string|File|Blob} source - URL-ul sau fișierul GLB
     * @param {Function} onProgress
     * @returns {Promise<boolean>}
     */
    async loadGLB(source, onProgress = () => {}) {
        if (!THREE.GLTFLoader) {
            console.error('THREE.GLTFLoader nu este disponibil.');
            return false;
        }

        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();

            const onLoad = (gltf) => {
                this.clear();
                this.avatarType = 'glb';

                const model = gltf.scene || gltf.scenes[0];
                this.targetMeshes = [];

                // Căutăm toate mesh-urile care conțin morphTargetDictionary
                model.traverse((child) => {
                    if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
                        this.targetMeshes.push(child);
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Auto-centrare și scalare a modelului GLTF
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                // Scalăm modelul astfel încât capul să aibă o dimensiune optimă în vizor
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = (maxDim > 0) ? (3.2 / maxDim) : 1.0;
                model.scale.set(scale, scale, scale);

                // Repoziționăm pentru ca fața să fie centrată pe axa Y
                model.position.x = -center.x * scale;
                model.position.y = -center.y * scale + 0.3;
                model.position.z = -center.z * scale;

                this.currentAvatarGroup.add(model);
                this._buildBlendshapeMap();
                this.isReady = true;

                console.log(`Model GLB încărcat cu succes. ${this.targetMeshes.length} mesh-uri cu morph targets detectate.`);
                resolve(true);
            };

            if (source instanceof File || source instanceof Blob) {
                const url = URL.createObjectURL(source);
                loader.load(url, onLoad, onProgress, (err) => {
                    URL.revokeObjectURL(url);
                    reject(err);
                });
            } else {
                loader.load(source, onLoad, onProgress, reject);
            }
        });
    }

    /**
     * Construiește harta de corespondență între denumirile standard ARKit și dicționarele mesh-urilor
     */
    _buildBlendshapeMap() {
        this.blendshapeMap = {};

        this.targetMeshes.forEach(mesh => {
            const dict = mesh.morphTargetDictionary;
            if (!dict) return;

            for (const [key, index] of Object.entries(dict)) {
                // Normalizăm numele pentru căutare flexibilă (case-insensitive, fără underscore)
                const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

                if (!this.blendshapeMap[normalized]) {
                    this.blendshapeMap[normalized] = [];
                }
                this.blendshapeMap[normalized].push({ mesh, index, originalName: key });
            }
        });
    }

    /**
     * Setează ponderea (weight 0.0 - 1.0) pentru un morph target dat
     */
    setMorphWeight(standardName, weight) {
        if (!this.isReady) return;

        const normalizedTarget = standardName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const entries = this.blendshapeMap[normalizedTarget];

        if (entries) {
            entries.forEach(({ mesh, index }) => {
                mesh.morphTargetInfluences[index] = weight;
            });
        }

        // Dacă e avatarul procedural, sincronizăm conturul buzelor și pleoapele pentru clipit realist
        if (this.avatarType === 'procedural') {
            if (standardName === 'eyeBlinkLeft') {
                if (this.leftEye) {
                    this.leftEye.scale.y = Math.max(0.04, 1.0 - weight * 0.96);
                }
                if (this.leftEyelid) {
                    this.leftEyelid.scale.y = 0.05 + weight * 0.95;
                    this.leftEyelid.position.y = 0.40 - weight * 0.08;
                }
                if (this.leftBrow) {
                    this.leftBrow.position.y = 0.72 - weight * 0.04;
                }
            } else if (standardName === 'eyeBlinkRight') {
                if (this.rightEye) {
                    this.rightEye.scale.y = Math.max(0.04, 1.0 - weight * 0.96);
                }
                if (this.rightEyelid) {
                    this.rightEyelid.scale.y = 0.05 + weight * 0.95;
                    this.rightEyelid.position.y = 0.40 - weight * 0.08;
                }
                if (this.rightBrow) {
                    this.rightBrow.position.y = 0.72 - weight * 0.04;
                }
            } else if (standardName === 'jawOpen' && this.mouthRim) {
                this.mouthRim.scale.y = 0.6 + weight * 0.9;
                this.mouthRim.position.y = -0.6 - weight * 0.25;
            } else if (standardName === 'mouthPucker' && this.mouthRim) {
                this.mouthRim.scale.x = 1.4 - weight * 0.6;
                this.mouthRim.position.z = 1.25 + weight * 0.15;
            } else if ((standardName === 'mouthSmileLeft' || standardName === 'mouthSmileRight') && this.mouthRim) {
                this.mouthRim.scale.x = 1.4 + weight * 0.35;
            }
        }
    }

    /**
     * Returnează ponderea curentă a unui blendshape
     */
    getMorphWeight(standardName) {
        const normalizedTarget = standardName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const entries = this.blendshapeMap[normalizedTarget];
        if (entries && entries.length > 0) {
            const { mesh, index } = entries[0];
            return mesh.morphTargetInfluences[index] || 0.0;
        }
        return 0.0;
    }

    /**
     * Curăță scena și resetează referințele
     */
    clear() {
        while (this.currentAvatarGroup.children.length > 0) {
            const obj = this.currentAvatarGroup.children[0];
            this.currentAvatarGroup.remove(obj);
        }
        this.targetMeshes = [];
        this.blendshapeMap = {};
        this.isReady = false;
        this.leftBrow = null;
        this.rightBrow = null;
        this.leftEyelid = null;
        this.rightEyelid = null;
    }
}

window.AvatarManager = AvatarManager;
