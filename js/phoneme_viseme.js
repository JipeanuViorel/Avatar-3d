/**
 * Proiect Grafică pe Calculator
 * Student: Jipeanu Viorel
 * Modul: Motor Fonetic & Matrice Viseme (Apple ARKit Blendshapes)
 * Implementează maparea fonetică automată prin RegEx pentru Limba Română și reguli G2P pentru Limba Engleză.
 */

class PhonemeVisemeEngine {
    constructor() {
        // Lista standard de blendshapes ARKit utilizate pentru articulație orală și mimică
        this.BLENDSHAPES = [
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

        // Starea de repaus (toate morph targets = 0)
        this.REST_STATE = Object.freeze(
            this.BLENDSHAPES.reduce((acc, key) => { acc[key] = 0.0; return acc; }, {})
        );

        // Matricea de Viseme ARKit definită conform specificației tehnice
        this.VISEMES = {
            // Grupa A: deschidere mare, rotundă (A, Ă, Â, Î, AH)
            'A': {
                name: 'A / AH (Deschidere mare)',
                weights: { jawOpen: 0.85, mouthFunnel: 0.25 }
            },
            // Grupa E: deschidere medie, întinsă lateral (E, EH, AE, I)
            'E': {
                name: 'E / I (Întindere laterală)',
                weights: { jawOpen: 0.30, mouthSmileLeft: 0.55, mouthSmileRight: 0.55, mouthStretchLeft: 0.45, mouthStretchRight: 0.45 }
            },
            // Grupa O_U: buze strânse, rotunjite, aduse în față (O, U, UH, W, OO)
            'O_U': {
                name: 'O / U (Buze rotunjite / Pucker)',
                weights: { jawOpen: 0.42, mouthPucker: 0.85, mouthFunnel: 0.70 }
            },
            // Grupa B_M_P: buze complet închise (bilabiale)
            'B_M_P': {
                name: 'B / M / P (Buze închise)',
                weights: { mouthClose: 1.0, jawOpen: 0.0 }
            },
            // Grupa F_V: dinții superiori ating buza inferioară (labiodentale)
            'F_V': {
                name: 'F / V (Labiodentale)',
                weights: { mouthShrugLower: 0.85, jawOpen: 0.15 }
            },
            // Grupa D_T_N_S_L: gură ușor întredeschisă, dinți vizibili (alveolare/dentale)
            'D_T_N_S_L': {
                name: 'D / T / N / S / L (Întredeschisă)',
                weights: { jawOpen: 0.22, mouthStretchLeft: 0.35, mouthStretchRight: 0.35 }
            },
            // Grupa SH_CH_J: sunete prepalatale și africate (Ș, J, CE, CI, GE, GI)
            'SH_CH_J': {
                name: 'Ș / J / CE (Prepalatale)',
                weights: { jawOpen: 0.32, mouthPucker: 0.45, mouthFunnel: 0.30 }
            },
            // Repaus / Pauză
            'REST': {
                name: 'Repaus (Neutral)',
                weights: {}
            }
        };

        // Coada curentă de viseme temporizate
        this.animationQueue = [];
        this.currentTarget = { ...this.REST_STATE };
        this.currentVisemeName = 'REST';
        this.isPlaying = false;
        this.activeLanguage = 'ro'; // 'ro' sau 'en'
    }

    /**
     * Setează limba activă ('ro' sau 'en')
     */
    setLanguage(lang) {
        this.activeLanguage = lang === 'en' ? 'en' : 'ro';
    }

    /**
     * Convertește un token (cuvânt sau fragment) în viseme folosind reguli fonetice RegEx
     * @param {string} text - textul primit de la LLM sau TTS
     * @param {number} totalDurationMs - durata estimată a rostirii în milisecunde
     * @returns {Array<{visemeKey: string, durationMs: number}>}
     */
    textToVisemeSequence(text, totalDurationMs = 0) {
        const cleanText = text.trim().toLowerCase();
        if (!cleanText) {
            return [{ visemeKey: 'REST', durationMs: 100 }];
        }

        const visemeKeys = (this.activeLanguage === 'ro')
            ? this._parseRomanianPhonetics(cleanText)
            : this._parseEnglishPhonetics(cleanText);

        if (visemeKeys.length === 0) {
            return [{ visemeKey: 'REST', durationMs: 100 }];
        }

        // Calcul durată per visemă
        const defaultDuration = Math.max(65, Math.min(130, Math.floor(totalDurationMs / visemeKeys.length) || 90));
        return visemeKeys.map(k => ({
            visemeKey: k,
            durationMs: defaultDuration
        }));
    }

    /**
     * Mapare fonetică avansată pentru Limba Română bazată pe RegEx și caracterul fonetic direct
     */
    _parseRomanianPhonetics(text) {
        const sequence = [];
        let i = 0;
        const len = text.length;

        while (i < len) {
            const ch = text[i];
            const nextCh = i + 1 < len ? text[i + 1] : '';
            const pair = ch + nextCh;
            const triple = pair + (i + 2 < len ? text[i + 2] : '');

            // Grupuri de litere specifice limbii române
            if (triple === 'che' || triple === 'chi' || triple === 'ghe' || triple === 'ghi') {
                sequence.push('D_T_N_S_L');
                sequence.push('E');
                i += 3;
                continue;
            }

            if (pair === 'ce' || pair === 'ci' || pair === 'ge' || pair === 'gi') {
                sequence.push('SH_CH_J');
                sequence.push('E');
                i += 2;
                continue;
            }

            // Diftongi românești
            if (pair === 'ea' || pair === 'ia') {
                sequence.push('E');
                sequence.push('A');
                i += 2;
                continue;
            }
            if (pair === 'oa' || pair === 'ua') {
                sequence.push('O_U');
                sequence.push('A');
                i += 2;
                continue;
            }
            if (pair === 'ou' || pair === 'au') {
                sequence.push('A');
                sequence.push('O_U');
                i += 2;
                continue;
            }

            // Litere individuale / caractere diacritice românești
            if (/[aăâ]/.test(ch)) {
                sequence.push('A');
            } else if (/[eéiî]/.test(ch)) {
                sequence.push('E');
            } else if (/[ou]/.test(ch)) {
                sequence.push('O_U');
            } else if (/[bmp]/.test(ch)) {
                sequence.push('B_M_P');
            } else if (/[fv]/.test(ch)) {
                sequence.push('F_V');
            } else if (/[ldtnszțr]/.test(ch)) {
                sequence.push('D_T_N_S_L');
            } else if (/[șj]/.test(ch)) {
                sequence.push('SH_CH_J');
            } else if (/[cgkqxh]/.test(ch)) {
                sequence.push('D_T_N_S_L');
            } else if (/[ \t\n,.\?!:;]/.test(ch)) {
                sequence.push('REST');
            }

            i++;
        }

        // Adăugăm o revenire în starea de repaus la sfârșit de cuvânt
        if (sequence.length > 0 && sequence[sequence.length - 1] !== 'REST') {
            sequence.push('REST');
        }

        return sequence;
    }

    /**
     * Mapare fonetică completă și robustă pentru Limba Engleză
     */
    _parseEnglishPhonetics(text) {
        const sequence = [];
        let i = 0;
        const len = text.length;

        while (i < len) {
            const ch = text[i];
            const nextCh = i + 1 < len ? text[i + 1] : '';
            const pair = ch + nextCh;
            const triple = pair + (i + 2 < len ? text[i + 2] : '');

            // 1. Trigrame & Bigrame speciale în limba engleză
            if (triple === 'ing' || triple === 'ion') {
                sequence.push('E');
                sequence.push('D_T_N_S_L');
                i += 3;
                continue;
            }

            if (pair === 'th') {
                sequence.push('D_T_N_S_L');
                i += 2;
                continue;
            }
            if (pair === 'sh' || pair === 'ch' || pair === 'dg') {
                sequence.push('SH_CH_J');
                i += 2;
                continue;
            }
            if (pair === 'ph') {
                sequence.push('F_V');
                i += 2;
                continue;
            }
            if (pair === 'wh') {
                sequence.push('O_U');
                i += 2;
                continue;
            }
            if (pair === 'ee' || pair === 'ea' || pair === 'ie' || pair === 'ey') {
                sequence.push('E');
                i += 2;
                continue;
            }
            if (pair === 'oo' || pair === 'ou' || pair === 'ow') {
                sequence.push('O_U');
                i += 2;
                continue;
            }
            if (pair === 'ai' || pair === 'ay' || pair === 'au' || pair === 'aw') {
                sequence.push('A');
                i += 2;
                continue;
            }

            // 2. Litere individuale din alfabetul englez
            if (/[a]/.test(ch)) {
                sequence.push('A');
            } else if (/[eiy]/.test(ch)) {
                sequence.push('E');
            } else if (/[ou]/.test(ch)) {
                sequence.push('O_U');
            } else if (/[w]/.test(ch)) {
                sequence.push('O_U');
            } else if (/[bmp]/.test(ch)) {
                sequence.push('B_M_P');
            } else if (/[fv]/.test(ch)) {
                sequence.push('F_V');
            } else if (/[ldtnszrk]/.test(ch)) {
                sequence.push('D_T_N_S_L');
            } else if (/[cgqx]/.test(ch)) {
                // c, g, q, x
                sequence.push('D_T_N_S_L');
            } else if (/[jh]/.test(ch)) {
                sequence.push('SH_CH_J');
            } else if (/[ \t\n,.\?!:;]/.test(ch)) {
                sequence.push('REST');
            }

            i++;
        }

        if (sequence.length > 0 && sequence[sequence.length - 1] !== 'REST') {
            sequence.push('REST');
        }

        return sequence;
    }

    /**
     * Înrolează o secvență de viseme pentru un cuvânt rostit,
     * optimizată pentru sincronizare instantanee fără latență acumulată
     */
    playWordSequence(sequence, onVisemeChangeCallback = null) {
        if (!sequence || sequence.length === 0) return;

        // Înlocuim coada pentru ca noul cuvânt rostit să controleze imediat buzele
        this.animationQueue = sequence.map(item => ({
            visemeKey: item.visemeKey,
            durationMs: item.durationMs,
            onVisemeChange: onVisemeChangeCallback
        }));

        if (!this.isPlaying) {
            this._processQueue();
        }
    }

    /**
     * Adaugă o secvență de viseme în coada de execuție
     */
    enqueueSequence(sequence, onVisemeChangeCallback = null) {
        for (const item of sequence) {
            this.animationQueue.push({
                visemeKey: item.visemeKey,
                durationMs: item.durationMs,
                onVisemeChange: onVisemeChangeCallback
            });
        }

        if (!this.isPlaying) {
            this._processQueue();
        }
    }

    /**
     * Procesează secvențial coada asincronă de viseme
     */
    async _processQueue() {
        if (this.animationQueue.length === 0) {
            this.isPlaying = false;
            this.setTargetViseme('REST');
            return;
        }

        this.isPlaying = true;
        const currentItem = this.animationQueue.shift();

        this.setTargetViseme(currentItem.visemeKey);
        if (currentItem.onVisemeChange) {
            currentItem.onVisemeChange(currentItem.visemeKey, this.VISEMES[currentItem.visemeKey]);
        }

        await new Promise(resolve => setTimeout(resolve, currentItem.durationMs));
        this._processQueue();
    }

    /**
     * Schimbă imediat ținta curentă de blendshapes conform visemei specificate
     */
    setTargetViseme(visemeKey) {
        const visemeDef = this.VISEMES[visemeKey] || this.VISEMES['REST'];
        this.currentVisemeName = visemeKey;

        // Resetăm valorile la 0
        const newTarget = { ...this.REST_STATE };

        // Aplicăm ponderile specifice visemei
        if (visemeDef.weights) {
            for (const [key, val] of Object.entries(visemeDef.weights)) {
                if (key in newTarget) {
                    newTarget[key] = val;
                }
            }
        }

        this.currentTarget = newTarget;
    }

    /**
     * Golește coada și oprește articulația
     */
    clearQueue() {
        this.animationQueue = [];
        this.isPlaying = false;
        this.setTargetViseme('REST');
    }

    /**
     * Returnează ponderile țintă curente pentru motorul de randare
     */
    getCurrentTargetWeights() {
        return this.currentTarget;
    }
}

// Export pentru utilizare globală în browser
window.PhonemeVisemeEngine = PhonemeVisemeEngine;
