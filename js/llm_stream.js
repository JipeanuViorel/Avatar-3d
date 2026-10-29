/**
 * Proiect Grafică pe Calculator
 * Student: Jipeanu Viorel
 * Modul de Comunicare și Streaming LLM (Ollama & Mock Engine)
 * Procesează fluxul de text la nivel de token pentru sincronizare cu latență minimă.
 */

class LLMStreamClient {
    constructor() {
        this.ollamaBaseUrl = 'http://localhost:11434';
        this.selectedModel = 'llama3';
        this.isStreaming = false;
        this.abortController = null;

        // Textul oficial de prezentare pentru modul Demo
        this.mockResponses = {
            ro: [
                "Salut! Acesta este proiectul meu de Grafică pe Calculator, realizat de studentul Jipeanu Viorel. Am dezvoltat un sistem procedural de animație în timp real ce combină interpolarea continuă Lerp pe blendshapes ARKit cu analiza fonetică a limbii române."
            ],
            en: [
                "Hello! This is my Computer Graphics project developed by student Jipeanu Viorel, demonstrating real-time procedural animation and speech articulation using ARKit blendshapes."
            ]
        };
    }

    /**
     * Verifică dacă serviciul Ollama este activ local
     */
    async checkOllamaStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                return { online: true, models: data.models || [] };
            }
            return { online: false, models: [] };
        } catch (e) {
            return { online: false, error: e.message, models: [] };
        }
    }

    /**
     * Generează text în mod streaming
     * @param {Object} options
     * @param {string} options.prompt - Cerința / mesajul utilizatorului
     * @param {string} options.language - 'ro' sau 'en'
     * @param {boolean} options.useMock - forțează modul de simulare
     * @param {Function} options.onToken - callback la fiecare token primit: (token) => {}
     * @param {Function} options.onChunk - callback când s-a format o propoziție/clauză: (chunk) => {}
     * @param {Function} options.onComplete - callback la final: (fullText) => {}
     * @param {Function} options.onError - callback în caz de eroare: (err) => {}
     */
    async generateStream({
        prompt,
        language = 'ro',
        useMock = false,
        onToken = () => {},
        onChunk = () => {},
        onComplete = () => {},
        onError = () => {}
    }) {
        if (this.isStreaming) {
            this.stopStream();
        }

        this.isStreaming = true;
        this.abortController = new AbortController();

        if (useMock) {
            await this._runMockStreaming({ prompt, language, onToken, onChunk, onComplete });
            return;
        }

        // Încercare streaming cu Ollama real
        try {
            const response = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.selectedModel,
                    prompt: prompt,
                    stream: true
                }),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama HTTP Error: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullText = '';
            let currentChunk = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const rawChunk = decoder.decode(value, { stream: true });
                const lines = rawChunk.split('\n').filter(line => line.trim().length > 0);

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        const token = parsed.response || '';
                        fullText += token;
                        currentChunk += token;
                        onToken(token);

                        // Emitem un chunk când întâlnim semne de punctuație pentru procesare TTS anticipată
                        if (/[.,!?;:\n]/.test(token) && currentChunk.trim().length > 0) {
                            onChunk(currentChunk.trim());
                            currentChunk = '';
                        }
                    } catch (err) {
                        console.warn('Eroare parsare JSON linie Ollama:', err);
                    }
                }
            }

            if (currentChunk.trim().length > 0) {
                onChunk(currentChunk.trim());
            }

            this.isStreaming = false;
            onComplete(fullText);

        } catch (err) {
            this.isStreaming = false;
            if (err.name === 'AbortError') {
                console.log('Streaming oprit de utilizator.');
            } else {
                console.warn('Ollama indisponibil. Se trece automat pe modul MOCK:', err);
                onError(err);
                // Fallback elegant la modul Mock dacă Ollama e offline
                await this._runMockStreaming({ prompt, language, onToken, onChunk, onComplete });
            }
        }
    }

    /**
     * Simulare realistă de streaming token-cu-token (35-50ms per token)
     * În modul Demo rostește exact textul specificat de autor
     */
    async _runMockStreaming({ prompt, language, onToken, onChunk, onComplete }) {
        const pool = this.mockResponses[language] || this.mockResponses['ro'];
        let selectedResponse = pool[0];

        // Descompunem răspunsul în cuvinte/tokeni
        const words = selectedResponse.split(/(\s+)/);
        let fullText = '';
        let currentChunk = '';

        for (const token of words) {
            if (!this.isStreaming) break;

            fullText += token;
            currentChunk += token;
            onToken(token);

            if (/[.,!?;:\n]/.test(token) && currentChunk.trim().length > 0) {
                onChunk(currentChunk.trim());
                currentChunk = '';
            }

            // Pauză între tokeni pentru efect vizual de generare live
            const delay = Math.floor(Math.random() * 25) + 30; // 30-55 ms
            await new Promise(r => setTimeout(r, delay));
        }

        if (currentChunk.trim().length > 0 && this.isStreaming) {
            onChunk(currentChunk.trim());
        }

        this.isStreaming = false;
        onComplete(fullText);
    }

    /**
     * Oprește streaming-ul activ
     */
    stopStream() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.isStreaming = false;
    }
}

window.LLMStreamClient = LLMStreamClient;
