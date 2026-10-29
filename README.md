# Talking Avatar 3D – Animație Procedurală & Lip-Sync Ghidat de LLM

**Proiect de Grafică pe Calculator**  
- **Autor:** Student Jipeanu Viorel  
- **Disciplina:** Grafică pe Calculator  
- **Tehnologii:** WebGL / Three.js, Apple ARKit Blendshapes (52), RegEx Phonetic Parser, Ollama API, Web Speech API  

Sistem de animație facială procedurală în timp real pentru avatare 3D, ghidat de modele lingvistice mari (LLM) rulate local prin **Ollama** sau mod demonstrativ (Mock), cu mapare fonetică automată pe matricea **Apple ARKit Blendshapes** și interpolare continuă (**Lerping**).

---

## 1. Arhitectura Generală a Sistemului

Pipeline-ul tehnic funcționează asincron în 3 etape distincte pentru a garanta o rată de cadre ridicată (60+ FPS) și latență minimă:

```
┌─────────────────┐       Text Stream       ┌────────────────────────┐    Audio + Viseme    ┌──────────────────────┐
│  Ollama (LLM)   │ ──────────────────────> │  Modul TTS + Foneme    │ ───────────────────> │ Motor Grafic Three.js│
│ (Llama 3 / Mock)│ (Token-by-Token Chunks) │ (RegEx Română / G2P En)│ (Timing & Keyframes) │ (ARKit Blendshapes)  │
└─────────────────┘                         └────────────────────────┘                      └──────────────────────┘
                                                                                                      │
                                                                                             Lerp Interpolation
                                                                                                      ▼
                                                                                            Randare 3D Fluidă
```

### Module Componente:
1. **Modulul LLM Stream (`js/llm_stream.js`)**:
   - Conectare prin `ReadableStream` la API-ul Ollama (`http://localhost:11434/api/generate`) cu streaming activ (`stream: true`).
   - Parsare JSON lines și acumulare în buffere de propoziții/clauze (`.` `,` `!` `?`) pentru emitere anticipată.
   - Include **Modul Demo/Mock Oficial** în care avatarul rostește exclusiv prezentarea oficială a proiectului realizat de Student Jipeanu Viorel.

2. **Modulul TTS & Sincronizare Fonetică (`js/tts.js` & `js/phoneme_viseme.js`)**:
   - Integrează `window.speechSynthesis` cu prioritate pentru voci feminine (Alina, Carmen, Maria) și calibrare tonală (pitch 1.22).
   - Evenimentele de frontieră lexicală (`onboundary - word`) declanșează secvențele de viseme calculate pe baza silabelor.
   - Fallback automat pe **Web Audio API** cu sinteză procedurală feminină în cazul sistemelor fără voci TTS native instalate.

3. **Motorul Grafic 3D & Interpolare Lerp (`js/scene.js` & `js/avatar.js`)**:
   - Scenă WebGL Three.js cu iluminare de studio PBR în trei puncte (Key Light, Fill Light, Rim Light).
   - Avatar procedural stilizat 3D cu geometrie configurată direct cu 12 morph targets ARKit esențiale.
   - Suport nativ de încărcare/drag-and-drop pentru orice avatar **Ready Player Me (.glb)** sau export ARKit.
   - Algoritm continuu de **Interpolare Liniară (Lerp)** pe matricea de ponderi faciale.
   - Animații procedurale autonome de repaus: clipit natural (`eyeBlinkLeft/Right`) și micro-pendulare de respirație/cap.

---

## 2. Matricea de Mapare Foneme -> Viseme (ARKit)

| Grupa de Sunete (Foneme) | Caracteristici Articulare | Visemă Mapată | Blendshape-uri ARKit Modificate |
|---|---|---|---|
| **A, Ă, Â, Î, AH** | Deschidere mare a maxilarului, cavitate deschisă | `A` | `jawOpen` (0.85), `mouthFunnel` (0.25) |
| **E, É, EH, AE, I** | Deschidere medie, colțurile gurii întinse lateral | `E` | `jawOpen` (0.30), `mouthSmileLeft/Right` (0.55), `mouthStretchLeft/Right` (0.45) |
| **O, U, UH, W, OO** | Buze rotunjite, aduse în față (pucker) | `O_U` | `jawOpen` (0.42), `mouthPucker` (0.85), `mouthFunnel` (0.70) |
| **B, M, P** | Ocluzie bilabială (buze complet lipite) | `B_M_P` | `mouthClose` (1.00), `jawOpen` (0.00) |
| **F, V** | Sunete labiodentale (dinții superiori pe buza de jos) | `F_V` | `mouthShrugLower` (0.85), `jawOpen` (0.15) |
| **L, D, T, N, S, Z, Ț, R** | Dentale/Alveolare, gură întredeschisă | `D_T_N_S_L` | `jawOpen` (0.22), `mouthStretchLeft/Right` (0.35) |
| **Ș, J, CE, CI, GE, GI** | Africate și prepalatale | `SH_CH_J` | `jawOpen` (0.32), `mouthPucker` (0.45), `mouthFunnel` (0.30) |
| **Pauză / Spațiu / Punct** | Stare neutră de repaus facial | `REST` | Toate ponderile revin spre `0.00` |

### Particularitatea Limbii Române (RegEx):
Datorită caracterului fonetic pronunțat al limbii române, analiza fonetică este efectuată prin reguli pe grupuri de caractere:
- **Trigrame & Bigrame speciale**: `che`, `chi`, `ghe`, `ghi` $\to$ `D_T_N_S_L` + `E`; `ce`, `ci`, `ge`, `gi` $\to$ `SH_CH_J` + `E`.
- **Diftongi**: `ea`, `ia` $\to$ tranziție `E` $\to$ `A`; `oa`, `ua` $\to$ tranziție `O_U` $\to$ `A`.
- **Diacritice**: `ă`, `â` $\to$ tratate cu deschidere `A`; `î` $\to$ tratat ca `E` / anterior.

---

## 3. Fundamentarea Matematică: Fluidizarea Mișcării (Lerping)

Pentru a preveni efectul robotic de "săritură" între pozițiile faciale, la fiecare iterație din bucla de randare (`requestAnimationFrame`) se calculează interpolarea liniară invariantă la variațiile de frame-rate:

$$w_{\text{curent}}(t + \Delta t) = w_{\text{curent}}(t) + \Big(w_{\text{target}}(t) - w_{\text{curent}}(t)\Big) \cdot \Big(1 - e^{-\lambda \cdot \Delta t}\Big)$$

Unde:
- $w_{\text{curent}}$ este ponderea curentă a unui morph target ($0.0 \le w \le 1.0$).
- $w_{\text{target}}$ este valoarea țintă impusă de visema activă.
- $\lambda$ este **Lerp Speed** (reglabil din interfață, implicit $16.0$).
- $\Delta t$ este timpul scurs de la ultimul cadru (`clock.getDelta()`).

> **Comparație A/B în Aplicație**: Utilizatorul poate debifa toggle-ul *"Activează Interpolare LERPING"* din interfață pentru a observa instantaneu diferența calitativă dintre o mișcare sacadată și tranziția netedă, organică.

---

## 4. Structura Fișierelor de Proiect

```
talking-avatar-3d/
│
├── index.html              # Interfața utilizator (Viewport 3D, Chat LLM, Telemetrie Blendshapes)
├── css/
│   └── styles.css          # Stiluri Dark Cyberpunk, bare de animație în timp real
├── js/
│   ├── app.js              # Orchestrator principal și legare evenimente UI
│   ├── scene.js            # Scena Three.js, lumini PBR, OrbitControls, bucla de Lerp
│   ├── avatar.js           # Generator cap 3D procedural ARKit + GLTF/GLB Loader
│   ├── phoneme_viseme.js   # Reguli fonetice RegEx (Română & Engleză) și matrice viseme
│   ├── llm_stream.js       # Client HTTP streaming Ollama + Mock Generator
│   └── tts.js              # Web Speech API + Web Audio API synthesizer
├── libs/
│   ├── three.min.js        # Motorul grafic Three.js (r128 local)
│   ├── OrbitControls.js    # Control cameră 3D (rotire, panoramare, zoom)
│   └── GLTFLoader.js       # Încărcător modele 3D GLTF / GLB
├── models/
│   ├── robot.glb           # Model 3D demonstrativ cu morph targets
│   └── sample.glb          # Primitivă GLTF pentru teste de deformație
├── start_server.ps1        # Server HTTP static în PowerShell (CORS & zero dependențe)
├── run.bat                 # Script de lansare rapidă cu dublu-clic
└── README.md               # Documentația tehnică completă a proiectului
```

---

## 5. Ghid de Rulare

### Pasul 1: Pornirea Aplicației
Aplicația include un server HTTP static ultra-rapid scris în PowerShell care rulează direct pe Windows fără a necesita instalarea de Node.js sau Python:

- **Opțiunea A**: Dublu-clic pe fișierul `run.bat`.
- **Opțiunea B**: Deschideți PowerShell în folderul proiectului și rulați:
  ```powershell
  .\start_server.ps1
  ```
Browserul se va deschide automat la adresa: `http://localhost:8080`.

### Pasul 2 (Opțional): Conectarea la Ollama Local
Dacă aveți utilitarul **Ollama** instalat pe calculator:
1. Porniți un model (de exemplu Llama 3):
   ```bash
   ollama run llama3
   ```
2. În interfața Talking Avatar 3D, debifați *"Mod Mock (Offline)"*.
3. Badge-ul va afișa `● Ollama Online (Localhost:11434)`.
4. Dacă Ollama nu este pornit, sistemul funcționează perfect autonom în **Modul Mock**.

### Pasul 3: Încărcarea unui Avatar Propriu Ready Player Me
1. Generați un avatar gratuit pe [readyplayer.me](https://readyplayer.me).
2. Descărcați fișierul `.glb`.
3. Trageți fișierul cu mouse-ul direct pe canvasul 3D (**Drag & Drop**) sau apăsați butonul *"Încarcă Ready Player Me (.GLB)"*.
4. Modelul va fi scalat și centrat automat, iar morph targets ARKit vor fi legate instant la motorul de vorbire!
