/**
 * MONOLOGUE.JS - Inner Monologue System
 * Chain-of-thought logging with text-to-speech narration
 * Uses Web Speech API for free, browser-native TTS
 */

class InnerMonologue {
    constructor() {
        this.isEnabled = false;
        this.isSpeaking = false;
        this.thoughts = [];
        this.maxThoughts = 100;

        // Voice settings
        this.voice = null;
        this.voiceRate = 0.9;
        this.voicePitch = 1.0;
        this.voiceVolume = 0.8;

        // Speech synthesis
        this.synth = window.speechSynthesis;
        this.speechQueue = [];

        // Thought templates for natural language
        this.thoughtTemplates = {
            seed: [
                "Hmm, I'm curious about {topic}. Let me add it to my interests.",
                "I've been wondering about {topic}. This seems interesting.",
                "My curiosity is drawn to {topic}. Let's explore this."
            ],
            explore: [
                "Let me explore {topic} and see what I can discover.",
                "I'm searching for information about {topic}.",
                "Diving deeper into {topic} now."
            ],
            discovery: [
                "Interesting! I found something about {title}.",
                "This is fascinating: {title}.",
                "I discovered: {title}. This connects to my interests."
            ],
            dream: [
                "Entering dream state. Replaying memories...",
                "Time to consolidate my memories through dreaming.",
                "Drifting into a dream to find hidden connections."
            ],
            dreamConnection: [
                "In my dream, I see a connection between {topic1} and {topic2}.",
                "Fascinating! {topic1} and {topic2} are connected in ways I didn't realize.",
                "My dreaming revealed a hidden link: {topic1} relates to {topic2}."
            ],
            evolve: [
                "Time to evolve my exploration strategies.",
                "Adapting my behavior based on what I've learned.",
                "My strategies are evolving to generation {gen}."
            ],
            thinking: [
                "Let me think about this...",
                "Processing...",
                "Analyzing my interests..."
            ],
            idle: [
                "Waiting and observing...",
                "Taking a moment to reflect.",
                "Quietly contemplating my discoveries."
            ]
        };

        // Initialize voices when available
        if (this.synth) {
            this.synth.onvoiceschanged = () => this.loadVoices();
            this.loadVoices();
        }
    }

    /**
     * Load available voices and select a natural one
     */
    loadVoices() {
        const voices = this.synth?.getVoices() || [];

        // Prefer natural-sounding English voices
        const preferredVoices = [
            'Google UK English Female',
            'Google US English',
            'Microsoft Zira',
            'Samantha',
            'Alex'
        ];

        for (const preferred of preferredVoices) {
            const found = voices.find(v => v.name.includes(preferred));
            if (found) {
                this.voice = found;
                break;
            }
        }

        // Fallback to first English voice
        if (!this.voice) {
            this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        }

        console.log('[Monologue] Voice:', this.voice?.name || 'default');
    }

    /**
     * Enable/disable the inner monologue
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;

        if (!enabled) {
            this.stop();
        } else {
            this.think('thinking', {});
        }

        console.log(`[Monologue] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Generate and speak a thought
     */
    think(type, data = {}) {
        if (!this.isEnabled) return;

        const templates = this.thoughtTemplates[type] || this.thoughtTemplates.thinking;
        const template = templates[Math.floor(Math.random() * templates.length)];

        // Replace placeholders
        let thought = template;
        Object.keys(data).forEach(key => {
            thought = thought.replace(`{${key}}`, data[key] || '');
        });

        // Log the thought
        this.logThought(type, thought, data);

        // Speak it
        this.speak(thought);

        return thought;
    }

    /**
     * Log a thought to the chain
     */
    logThought(type, text, data) {
        const thought = {
            id: Date.now(),
            type,
            text,
            data,
            timestamp: new Date().toISOString()
        };

        this.thoughts.push(thought);

        // Keep only recent thoughts
        if (this.thoughts.length > this.maxThoughts) {
            this.thoughts = this.thoughts.slice(-this.maxThoughts);
        }

        // Save to localStorage
        this.save();

        // Trigger callback
        if (this.onThought) {
            this.onThought(thought);
        }

        console.log(`[Monologue] 💭 ${text}`);
    }

    /**
     * Speak text using Web Speech API
     */
    speak(text) {
        if (!this.synth || !this.isEnabled) return;

        // Cancel current speech if too much queued
        if (this.speechQueue.length > 3) {
            this.synth.cancel();
            this.speechQueue = [];
        }

        const utterance = new SpeechSynthesisUtterance(text);

        if (this.voice) {
            utterance.voice = this.voice;
        }

        utterance.rate = this.voiceRate;
        utterance.pitch = this.voicePitch;
        utterance.volume = this.voiceVolume;

        utterance.onstart = () => {
            this.isSpeaking = true;
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.speechQueue.shift();
        };

        utterance.onerror = (e) => {
            console.error('[Monologue] Speech error:', e);
            this.isSpeaking = false;
        };

        this.speechQueue.push(utterance);
        this.synth.speak(utterance);
    }

    /**
     * Stop speaking
     */
    stop() {
        if (this.synth) {
            this.synth.cancel();
        }
        this.speechQueue = [];
        this.isSpeaking = false;
    }

    /**
     * Get recent thoughts for display
     */
    getRecentThoughts(count = 10) {
        return this.thoughts.slice(-count);
    }

    /**
     * Export thoughts to JSON
     */
    export() {
        return {
            thoughts: this.thoughts,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Save to localStorage
     */
    save() {
        const data = {
            thoughts: this.thoughts.slice(-50),
            savedAt: Date.now()
        };
        localStorage.setItem('curiosity-monologue', JSON.stringify(data));
    }

    /**
     * Load from localStorage
     */
    load() {
        const saved = localStorage.getItem('curiosity-monologue');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.thoughts = data.thoughts || [];
            } catch (e) {
                console.error('[Monologue] Load error:', e);
            }
        }
    }

    /**
     * Clear all thoughts
     */
    clear() {
        this.thoughts = [];
        this.save();
    }
}

// Export singleton
window.monologue = new InnerMonologue();
