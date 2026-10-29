/**
 * Proiect Grafică pe Calculator
 * Student: Jipeanu Viorel
 * Orchestratorul Principal al Aplicației (Talking Avatar 3D)
 * Coordonează fluxul complet între LLM, TTS, Motorul Fonetic și Scena 3D Three.js.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inițializare componente cheie
    const viewport = document.getElementById('viewport-container');
    const scene = new GraphicsScene(viewport);
    const avatar = new AvatarManager(scene.scene);
    const phonemeEngine = new PhonemeVisemeEngine();
    const llmClient = new LLMStreamClient();
    const tts = new TTSManager();

    // Legăm managerii la motorul grafic
    scene.attachManagers(avatar, phonemeEngine);

    // Încărcăm avatarul procedural 3D nativ
    avatar.buildProceduralAvatar();

    // 2. Selectare elemente UI
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const langSelect = document.getElementById('lang-select');
    const mockModeToggle = document.getElementById('mock-mode-toggle');
    const ollamaStatusBadge = document.getElementById('ollama-status-badge');
    const tokenStreamBox = document.getElementById('token-stream-box');
    const currentVisemeBadge = document.getElementById('current-viseme-badge');
    const currentGroupBadge = document.getElementById('current-group-badge');
    const lerpSpeedSlider = document.getElementById('lerp-speed-slider');
    const lerpSpeedVal = document.getElementById('lerp-speed-val');
    const lerpToggle = document.getElementById('lerp-toggle');
    const avatarSelectBtn = document.getElementById('avatar-file-input');
    const resetAvatarBtn = document.getElementById('reset-avatar-btn');
    const quickPromptBtns = document.querySelectorAll('.quick-prompt-btn');
    const blendshapeBarsContainer = document.getElementById('blendshape-bars');

    // 3. Generare bare grafice pentru monitorizarea Blendshape-urilor în timp real
    const barElements = {};
    phonemeEngine.BLENDSHAPES.forEach(shapeName => {
        const item = document.createElement('div');
        item.className = 'bs-item';
        item.innerHTML = `
            <div class="bs-label">
                <span>${shapeName}</span>
                <span class="bs-value" id="val-${shapeName}">0.00</span>
            </div>
            <div class="bs-track">
                <div class="bs-fill" id="fill-${shapeName}" style="width: 0%;"></div>
            </div>
        `;
        blendshapeBarsContainer.appendChild(item);
        barElements[shapeName] = {
            fill: item.querySelector(`#fill-${shapeName}`),
            val: item.querySelector(`#val-${shapeName}`)
        };
    });

    // 4. Verificare status Ollama local
    async function checkOllama() {
        const res = await llmClient.checkOllamaStatus();
        if (res.online) {
            ollamaStatusBadge.className = 'status-badge online';
            ollamaStatusBadge.innerHTML = '● Ollama Online (Localhost:11434)';
            mockModeToggle.checked = false;
        } else {
            ollamaStatusBadge.className = 'status-badge mock';
            ollamaStatusBadge.innerHTML = '● Mod Mock Activ (Ollama Offline)';
            mockModeToggle.checked = true;
        }
    }
    checkOllama();

    // 5. Configurare sincronizare TTS și Viseme
    tts.onSpeechStart = () => {
        tokenStreamBox.classList.add('speaking');
    };

    tts.onSpeechEnd = () => {
        tokenStreamBox.classList.remove('speaking');
        phonemeEngine.clearQueue();
        updateVisemeUI('REST', phonemeEngine.VISEMES['REST']);
    };

    // La fiecare cuvânt pronunțat de TTS, declanșăm secvența de viseme
    tts.onWordSpoken = (word) => {
        const sequence = phonemeEngine.textToVisemeSequence(word);
        phonemeEngine.playWordSequence(sequence, (visemeKey, visemeDef) => {
            updateVisemeUI(visemeKey, visemeDef);
        });
    };

    function updateVisemeUI(visemeKey, visemeDef) {
        if (!visemeDef) return;
        currentVisemeBadge.textContent = visemeKey;
        currentGroupBadge.textContent = visemeDef.name || 'Repaus';
    }

    // 6. Gestionare Streaming LLM
    async function handleSend() {
        const prompt = promptInput.value.trim();
        if (!prompt && !mockModeToggle.checked) return;

        sendBtn.disabled = true;
        stopBtn.disabled = false;
        tokenStreamBox.textContent = '';
        tts.stop();
        phonemeEngine.clearQueue();

        const lang = langSelect.value;
        const useMock = mockModeToggle.checked;

        const defaultDemoText = (lang === 'en')
            ? "Hello! This is my Computer Graphics project developed by student Jipeanu Viorel, demonstrating real-time procedural animation and speech articulation using ARKit blendshapes."
            : "Salut! Acesta este proiectul meu de Grafică pe Calculator, realizat de studentul Jipeanu Viorel. Am dezvoltat un sistem procedural de animație în timp real ce combină interpolarea continuă Lerp pe blendshapes ARKit cu analiza fonetică a limbii române.";

        await llmClient.generateStream({
            prompt: prompt || defaultDemoText,
            language: lang,
            useMock: useMock,
            onToken: (token) => {
                tokenStreamBox.textContent += token;
                tokenStreamBox.scrollTop = tokenStreamBox.scrollHeight;
            },
            onChunk: (chunk) => {
                // Trimitem chunk-ul format către TTS
                tts.speak(chunk);
            },
            onComplete: (fullText) => {
                sendBtn.disabled = false;
                stopBtn.disabled = true;
            },
            onError: (err) => {
                console.error(err);
                sendBtn.disabled = false;
                stopBtn.disabled = true;
            }
        });
    }

    function handleStop() {
        llmClient.stopStream();
        tts.stop();
        phonemeEngine.clearQueue();
        sendBtn.disabled = false;
        stopBtn.disabled = true;
        tokenStreamBox.classList.remove('speaking');
    }

    // 7. Event Listeners UI
    sendBtn.addEventListener('click', handleSend);
    stopBtn.addEventListener('click', handleStop);

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    langSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        phonemeEngine.setLanguage(lang);
        tts.updateVoiceForLanguage(lang);

        // Actualizăm butonul de prezentare rapidă și placeholder-ul conform limbii selectate
        const officialBtn = document.querySelector('.quick-prompt-btn');
        if (officialBtn) {
            if (lang === 'en') {
                officialBtn.textContent = '🎙️ Speak Official Presentation (Jipeanu Viorel)';
                officialBtn.setAttribute('data-prompt', 'Hello! This is my Computer Graphics project developed by student Jipeanu Viorel, demonstrating real-time procedural animation and speech articulation using ARKit blendshapes.');
                promptInput.placeholder = "Click 'Generează & Articulează' to speak English presentation...";
            } else {
                officialBtn.textContent = '🎙️ Rostește Prezentarea Oficială (Jipeanu Viorel)';
                officialBtn.setAttribute('data-prompt', 'Salut! Acesta este proiectul meu de Grafică pe Calculator, realizat de studentul Jipeanu Viorel. Am dezvoltat un sistem procedural de animație în timp real ce combină interpolarea continuă Lerp pe blendshapes ARKit cu analiza fonetică a limbii române.');
                promptInput.placeholder = "Apăsați 'Generează & Articulează' pentru a porni prezentarea feminină a proiectului...";
            }
        }
    });

    lerpSpeedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        lerpSpeedVal.textContent = val.toFixed(1);
        scene.setLerpSpeed(val);
    });

    lerpToggle.addEventListener('change', (e) => {
        scene.setLerpEnabled(e.target.checked);
    });

    // Butoane pentru prompte rapide demonstrative
    quickPromptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            promptInput.value = btn.getAttribute('data-prompt');
            handleSend();
        });
    });

    // Încărcare model extern GLB (Ready Player Me etc.)
    avatarSelectBtn.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            document.getElementById('loading-overlay').style.display = 'flex';
            await avatar.loadGLB(file);
            document.getElementById('loading-overlay').style.display = 'none';
            alert(`Modelul 3D "${file.name}" a fost încărcat cu succes!`);
        } catch (err) {
            document.getElementById('loading-overlay').style.display = 'none';
            alert('Eroare la încărcarea modelului GLB: ' + err.message);
        }
    });

    resetAvatarBtn.addEventListener('click', () => {
        avatar.buildProceduralAvatar();
    });

    // Suport Drag & Drop pentru fișiere GLB pe viewport-ul 3D
    viewport.addEventListener('dragover', (e) => {
        e.preventDefault();
        viewport.classList.add('drag-active');
    });

    viewport.addEventListener('dragleave', () => {
        viewport.classList.remove('drag-active');
    });

    viewport.addEventListener('drop', async (e) => {
        e.preventDefault();
        viewport.classList.remove('drag-active');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.toLowerCase().endsWith('.glb')) {
            try {
                document.getElementById('loading-overlay').style.display = 'flex';
                await avatar.loadGLB(files[0]);
                document.getElementById('loading-overlay').style.display = 'none';
            } catch (err) {
                document.getElementById('loading-overlay').style.display = 'none';
                alert('Eroare la procesarea fișierului GLB: ' + err.message);
            }
        }
    });

    // 8. Pornire buclă de randare și actualizare grafică a barelor Blendshape în timp real
    scene.startRenderLoop((currentWeights) => {
        for (const [key, weight] of Object.entries(currentWeights)) {
            const bar = barElements[key];
            if (bar) {
                const percent = Math.min(100, Math.max(0, weight * 100));
                bar.fill.style.width = `${percent.toFixed(1)}%`;
                bar.val.textContent = weight.toFixed(2);

                // Evidențiere dacă ponderea e semnificativă
                if (weight > 0.15) {
                    bar.val.style.color = '#00f0ff';
                } else {
                    bar.val.style.color = '#94a3b8';
                }
            }
        }
    });
});
