/**
 * Proiect Grafică pe Calculator
 * Student: Jipeanu Viorel
 * Modul: Sinteză Vocală (Text-To-Speech) & Sincronizare Fonetică
 * Utilizează Web Speech API cu suport pentru limba română (ro-RO) și engleză (en-US)
 * și sintetizator procedural Web Audio API integrat ca rezervă.
 */

class TTSManager {
    constructor() {
        this.synth = window.speechSynthesis || null;
        this.availableVoices = [];
        this.selectedVoice = null;
        this.activeLanguage = 'ro';
        this.speechQueue = [];
        this.isSpeaking = false;
        this.audioContext = null;
        this.activeTimers = [];

        // Callback-uri pentru sincronizare
        this.onWordSpoken = null; // (word, charIndex) => {}
        this.onSpeechStart = null;
        this.onSpeechEnd = null;

        this._initVoices();
    }

    _initVoices() {
        if (!this.synth) {
            console.warn('Web Speech API nu este suportat în acest browser.');
            return;
        }

        const loadVoices = () => {
            this.availableVoices = this.synth.getVoices();
            this.updateVoiceForLanguage(this.activeLanguage);
        };

        loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }
    }

    /**
     * Schimbă limba activă și alege cu prioritate o voce feminină din sistem
     */
    updateVoiceForLanguage(langCode) {
        this.activeLanguage = langCode;
        if (!this.availableVoices || this.availableVoices.length === 0) return;

        const targetLangPrefix = langCode === 'ro' ? 'ro' : 'en';

        // Filtrăm vocile după limba țintă
        const langVoices = this.availableVoices.filter(v =>
            v.lang.toLowerCase().startsWith(targetLangPrefix)
        );

        // Cuvinte cheie pentru detecția vocilor feminine românești sau internaționale
        const femaleKeywords = ['alina', 'carmen', 'ioana', 'maria', 'elena', 'female', 'femeie', 'zira', 'jenny', 'aria', 'samantha', 'victoria', 'natural'];

        // Căutare prioritară voce feminină
        let femaleMatch = langVoices.find(v => {
            const nameLower = v.name.toLowerCase();
            return femaleKeywords.some(k => nameLower.includes(k));
        });

        if (femaleMatch) {
            this.selectedVoice = femaleMatch;
            console.log(`Voce feminină selectată pentru [${langCode}]:`, femaleMatch.name, femaleMatch.lang);
        } else if (langVoices.length > 0) {
            this.selectedVoice = langVoices[0];
            console.log(`Voce selectată pentru [${langCode}]:`, this.selectedVoice.name);
        } else {
            // Fallback la prima voce din sistem
            this.selectedVoice = this.availableVoices[0] || null;
        }
    }

    /**
     * Adaugă un text sau fragment în coada de redare vocală
     */
    speak(text, onBoundaryCallback = null) {
        if (!text || text.trim().length === 0) return;

        this.speechQueue.push({ text: text.trim(), onBoundary: onBoundaryCallback });
        if (!this.isSpeaking) {
            this._processNextInQueue();
        }
    }

    _clearTimers() {
        if (this.activeTimers && this.activeTimers.length > 0) {
            this.activeTimers.forEach(id => clearTimeout(id));
            this.activeTimers = [];
        }
    }

    _processNextInQueue() {
        if (this.speechQueue.length === 0) {
            this.isSpeaking = false;
            this._clearTimers();
            if (this.onSpeechEnd) this.onSpeechEnd();
            return;
        }

        this.isSpeaking = true;
        const currentItem = this.speechQueue.shift();

        if (!this.synth) {
            // Fallback la sinteză audio procedurală Web Audio
            this._playProceduralToneFallback(currentItem.text, () => {
                this._processNextInQueue();
            });
            return;
        }

        const utterance = new SpeechSynthesisUtterance(currentItem.text);
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.lang = this.activeLanguage === 'ro' ? 'ro-RO' : 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.22; // Tonalitate feminină optimizată (1.20 - 1.25)

        let boundaryReceived = false;
        this._clearTimers();

        utterance.onstart = () => {
            if (this.onSpeechStart) this.onSpeechStart();

            // Preluăm cuvintele din fragmentul curent
            const words = currentItem.text.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) return;

            // Ritmul mediu de vorbire: ~150-180 cuvinte/minut (cca. 280-360ms per cuvânt)
            let timeAccumulatorMs = 0;
            words.forEach((w, idx) => {
                const wordClean = w.replace(/^[^\wăâîșț]+|[^\wăâîșț]+$/gi, '');
                // Durată proporțională cu lungimea silabelor
                const wordDuration = Math.max(220, Math.min(550, (wordClean.length || 3) * 65));

                const timerId = setTimeout(() => {
                    // Dacă vocea nu a emis onboundary (specific vocilor online/cloud în Edge/Chrome),
                    // sincronizatorul autonom livrează cuvântul direct către motorul de viseme!
                    if (!boundaryReceived && this.isSpeaking) {
                        if (currentItem.onBoundary) {
                            currentItem.onBoundary(w, idx);
                        }
                        if (this.onWordSpoken) {
                            this.onWordSpoken(w, idx);
                        }
                    }
                }, timeAccumulatorMs);

                this.activeTimers.push(timerId);
                timeAccumulatorMs += wordDuration;
            });
        };

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                boundaryReceived = true;
                this._clearTimers(); // onboundary nativ este activ, anulăm timer-ul autonom

                const spokenWord = currentItem.text.substr(event.charIndex).split(/\s+/)[0];
                if (currentItem.onBoundary) {
                    currentItem.onBoundary(spokenWord, event.charIndex);
                }
                if (this.onWordSpoken) {
                    this.onWordSpoken(spokenWord, event.charIndex);
                }
            }
        };

        utterance.onend = () => {
            this._clearTimers();
            this._processNextInQueue();
        };

        utterance.onerror = (e) => {
            this._clearTimers();
            console.warn('Eroare TTS Utterance:', e);
            this._processNextInQueue();
        };

        this.synth.speak(utterance);
    }

    /**
     * Oprește orice redare audio activă
     */
    stop() {
        this.speechQueue = [];
        this.isSpeaking = false;
        this._clearTimers();
        if (this.synth) {
            this.synth.cancel();
        }
        if (this.onSpeechEnd) {
            this.onSpeechEnd();
        }
    }

    /**
     * Mecanism de rezervă bazat pe Web Audio API (formant sound)
     */
    _playProceduralToneFallback(text, onComplete) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!this.audioContext) {
                this.audioContext = new AudioContext();
            }

            const ctx = this.audioContext;
            const words = text.split(/\s+/);
            let timeOffset = ctx.currentTime;

            words.forEach((w, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                // Frecvență fundamentală feminină (F0 ~ 260-320 Hz)
                osc.frequency.setValueAtTime(260 + (idx % 4) * 25, timeOffset);

                gain.gain.setValueAtTime(0.08, timeOffset);
                gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.18);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(timeOffset);
                osc.stop(timeOffset + 0.2);

                setTimeout(() => {
                    if (this.onWordSpoken) this.onWordSpoken(w, idx);
                }, (timeOffset - ctx.currentTime) * 1000);

                timeOffset += 0.22;
            });

            setTimeout(() => {
                onComplete();
            }, (timeOffset - ctx.currentTime) * 1000 + 100);

        } catch (e) {
            console.error('AudioContext fallback error:', e);
            onComplete();
        }
    }
}

window.TTSManager = TTSManager;
