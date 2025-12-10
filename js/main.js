/**
 * MAIN.JS - Application Entry Point
 * Initializes all modules and handles UI interactions
 */

class CuriousExplorerApp {
    constructor() {
        this.viz = null;
        this.isInitialized = false;

        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the application
     */
    init() {
        console.log('[App] Initializing Curious Explorer...');

        // Load saved state
        window.brain.load();
        window.memory.loadLongTermMemory();
        window.memory.retrieveLongTermMemories();

        // Initialize visualization
        this.viz = new BrainVisualization('brain-canvas');
        this.viz.start();

        // Setup UI event listeners
        this.setupEventListeners();

        // Setup brain callbacks
        this.setupBrainCallbacks();

        // Initial UI update
        this.updateUI();

        // Generate initial suggestions
        window.suggestions.generateSuggestions().then(() => {
            this.renderSuggestions();
        });

        // Setup auto-refresh
        this.setupAutoRefresh();

        this.isInitialized = true;
        console.log('[App] Initialization complete');

        // Update status
        this.setStatus('Ready', 'idle');
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Add interest button
        const addBtn = document.getElementById('add-interest-btn');
        const topicInput = document.getElementById('topic-input');

        addBtn?.addEventListener('click', () => this.addInterestFromInput());
        topicInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addInterestFromInput();
        });

        // Quick topics
        document.querySelectorAll('.quick-topic').forEach(el => {
            el.addEventListener('click', () => {
                const topic = el.dataset.topic;
                window.brain.addInterest(topic, 0.3);
                this.updateUI();
            });
        });

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.viz.setViewMode(btn.dataset.view);
            });
        });

        // Explore button
        document.getElementById('explore-btn')?.addEventListener('click', async () => {
            this.setStatus('Exploring...', 'active');
            await window.explorer.explore();
            this.renderDiscoveries();
            this.updateUI();
            this.setStatus('Ready', 'idle');
        });

        // Consolidate button
        document.getElementById('consolidate-btn')?.addEventListener('click', () => {
            this.setStatus('Consolidating...', 'active');
            const results = window.memory.consolidate();
            this.showConsolidationResults(results);
            this.updateUI();
            this.setStatus('Ready', 'idle');
        });

        // Export button
        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportBrain();
        });

        // Import button
        document.getElementById('import-btn')?.addEventListener('click', () => {
            document.getElementById('import-file')?.click();
        });

        document.getElementById('import-file')?.addEventListener('change', (e) => {
            this.importBrain(e.target.files[0]);
        });

        // Reset button
        document.getElementById('reset-btn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                window.brain.reset();
                window.memory.reset();
                window.explorer.reset();
                window.dreamer?.reset();
                window.genetics?.reset();
                this.updateUI();
                this.viz.updateFromBrain();
            }
        });

        // Dream Replay button
        document.getElementById('dream-btn')?.addEventListener('click', async () => {
            if (window.brain.interests.size < 3) {
                alert('Need at least 3 interests to start dreaming!');
                return;
            }

            this.showDreamingOverlay();
            this.setStatus('Dreaming...', 'active');

            const result = await window.dreamer.dream();

            this.hideDreamingOverlay();
            this.updateUI();
            this.viz.updateFromBrain();

            if (result.success) {
                const session = result.session;
                this.setStatus(`Dream: ${session.newConnections.length} connections found!`, 'idle');
                console.log('[App] Dream insights:', session.insights);
            } else {
                this.setStatus('Ready', 'idle');
            }

            setTimeout(() => this.setStatus('Ready', 'idle'), 5000);
        });

        // Evolve Strategies button
        document.getElementById('evolve-btn')?.addEventListener('click', () => {
            this.setStatus('Evolving...', 'active');

            const result = window.genetics.evolve();

            this.updateEvolutionUI();

            if (result) {
                this.setStatus(`Generation ${result.generation} evolved!`, 'idle');
                console.log('[App] Best strategy:', result.bestStrategy);
            }

            setTimeout(() => this.setStatus('Ready', 'idle'), 3000);
        });

        // Setup dreamer callbacks
        if (window.dreamer) {
            window.dreamer.loadDreamLog();

            window.dreamer.onDreamStart = () => {
                this.setStatus('💤 Dreaming...', 'active');
            };

            window.dreamer.onConnectionDiscovered = (conn) => {
                console.log('[App] Dream connection:', conn.from, '↔', conn.to);
            };
        }

        // Setup genetics callbacks
        if (window.genetics) {
            window.genetics.onNewGeneration = (gen, population) => {
                this.updateEvolutionUI();
            };

            this.updateEvolutionUI();
        }

        // Setup autonomy toggle
        const autonomyToggle = document.getElementById('autonomy-toggle');
        if (autonomyToggle && window.autonomy) {
            autonomyToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    window.autonomy.start();
                    this.setStatus('🤖 Autonomous', 'active');
                } else {
                    window.autonomy.stop();
                    this.setStatus('Manual mode', 'idle');
                }
            });

            // Set initial state
            if (autonomyToggle.checked) {
                window.autonomy.start();
            }

            // Listen for autonomy actions
            window.autonomy.onAction = (action, result) => {
                console.log(`[App] Autonomy ${action}:`, result);
                this.updateUI();
                this.renderDiscoveries();
            };

            window.autonomy.onStatusChange = (status) => {
                if (status === 'running') {
                    this.setStatus('🤖 Autonomous', 'active');
                } else {
                    this.setStatus('Manual mode', 'idle');
                }
            };
        }

        // Setup monologue toggle
        const monologueToggle = document.getElementById('monologue-toggle');
        if (monologueToggle && window.monologue) {
            window.monologue.load();

            monologueToggle.addEventListener('change', (e) => {
                window.monologue.setEnabled(e.target.checked);
            });

            // Display thoughts in console and optionally UI
            window.monologue.onThought = (thought) => {
                // Could add a thought bubble UI here
                console.log(`[Thought] 💭 ${thought.text}`);
            };
        }
    }

    /**
     * Setup brain event callbacks
     */
    setupBrainCallbacks() {
        window.brain.onInterestAdded = (node) => {
            console.log('[App] Interest added:', node.topic);
            this.updateUI();
        };

        window.brain.onInterestUpdated = (node) => {
            this.updateUI();
        };

        window.brain.onInterestRemoved = (node) => {
            console.log('[App] Interest removed:', node.topic);
            this.updateUI();
        };

        window.explorer.onDiscovery = (discoveries) => {
            console.log('[App] New discoveries:', discoveries.length);
            this.renderDiscoveries();
            this.updateUI();
        };

        window.explorer.onExplorationStart = () => {
            this.setStatus('Exploring...', 'active');
        };

        window.explorer.onExplorationEnd = () => {
            this.setStatus('Ready', 'idle');
        };

        window.suggestions.onSuggestionsUpdated = () => {
            this.renderSuggestions();
        };
    }

    /**
     * Setup auto-refresh intervals
     */
    setupAutoRefresh() {
        // Refresh suggestions every 5 minutes
        setInterval(() => {
            window.suggestions.generateSuggestions();
        }, 5 * 60 * 1000);

        // Auto-explore every 30 minutes if idle
        setInterval(async () => {
            if (window.brain.interests.size > 0) {
                console.log('[App] Auto-exploration triggered');
                await window.explorer.explore();
            }
        }, 30 * 60 * 1000);

        // Update UI stats every 10 seconds
        setInterval(() => this.updateUI(), 10000);
    }

    /**
     * Add interest from input field
     */
    addInterestFromInput() {
        const input = document.getElementById('topic-input');
        const topic = input.value.trim();

        if (topic) {
            window.brain.addInterest(topic, 0.3);
            input.value = '';
            this.updateUI();

            // Trigger exploration for new topic
            window.explorer.explore(topic).then(() => {
                this.renderDiscoveries();
            });
        }
    }

    /**
     * Update all UI elements
     */
    updateUI() {
        const stats = window.brain.getStats();
        const capacity = window.memory.getCapacityStatus();
        const explorerStats = window.explorer.getStats();

        // Update stat values
        document.getElementById('short-term-count').textContent = stats.shortTerm;
        document.getElementById('long-term-count').textContent = stats.longTerm;
        document.getElementById('connections-count').textContent = stats.connections;
        document.getElementById('discoveries-count').textContent = explorerStats.totalDiscoveries;

        // Update memory bar
        const percentage = capacity.shortTerm.percentage;
        document.getElementById('memory-progress').style.width = `${percentage}%`;
        document.getElementById('memory-percentage').textContent = Math.round(percentage);

        // Update last sync time
        const saved = localStorage.getItem('curiosity-brain');
        if (saved) {
            const data = JSON.parse(saved);
            const date = new Date(data.savedAt);
            document.getElementById('last-sync-time').textContent =
                date.toLocaleTimeString();
        }
    }

    /**
     * Render suggestions list
     */
    renderSuggestions() {
        const container = document.getElementById('suggestions-list');
        if (!container) return;

        const suggestions = window.suggestions.getSuggestions();

        if (suggestions.length === 0) {
            container.innerHTML = `
                <div class="suggestion-placeholder">
                    Add interests to see suggestions...
                </div>
            `;
            return;
        }

        container.innerHTML = suggestions.slice(0, 5).map(s => `
            <div class="suggestion-item" data-topic="${this.escapeHtml(s.topic)}">
                <span class="suggestion-score">${(s.score * 100).toFixed(0)}%</span>
                <span class="suggestion-topic">${this.escapeHtml(s.topic)}</span>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                const topic = el.dataset.topic;
                window.brain.addInterest(topic, 0.2);
                window.explorer.explore(topic);
                this.updateUI();
            });
        });
    }

    /**
     * Render discoveries list
     */
    renderDiscoveries() {
        const container = document.getElementById('discoveries-list');
        if (!container) return;

        const discoveries = window.explorer.getRecentDiscoveries(10);

        if (discoveries.length === 0) {
            container.innerHTML = `
                <div class="discovery-placeholder">
                    Discoveries will appear here...
                </div>
            `;
            return;
        }

        container.innerHTML = discoveries.map(d => `
            <div class="discovery-item" data-url="${this.escapeHtml(d.url)}">
                <div class="discovery-title">${this.escapeHtml(d.title)}</div>
                <div class="discovery-source">${d.source}</div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.discovery-item').forEach(el => {
            el.addEventListener('click', () => {
                window.open(el.dataset.url, '_blank');
            });
        });
    }

    /**
     * Set status indicator
     */
    setStatus(text, state) {
        const dot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');

        if (statusText) statusText.textContent = text;

        if (dot) {
            dot.style.background = state === 'active' ? '#f59e0b' : '#10b981';
            dot.style.animation = state === 'active' ? 'blink 0.5s ease-in-out infinite' : 'blink 1.5s ease-in-out infinite';
        }
    }

    /**
     * Show consolidation results
     */
    showConsolidationResults(results) {
        const promoted = results.promoted.length;
        const forgotten = results.forgotten.length;

        console.log(`[App] Consolidation: ${promoted} promoted, ${forgotten} forgotten`);

        // Could show a toast notification here
        if (promoted > 0) {
            this.setStatus(`Promoted ${promoted} memories`, 'idle');
            setTimeout(() => this.setStatus('Ready', 'idle'), 3000);
        }
    }

    /**
     * Export brain state to JSON file
     */
    exportBrain() {
        const data = {
            brain: window.brain.export(),
            memory: window.memory.export(),
            discoveries: window.explorer.export(),
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `curious-explorer-brain-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        console.log('[App] Brain exported');
    }

    /**
     * Import brain state from JSON file
     */
    importBrain(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.brain) window.brain.import(data.brain);
                if (data.memory) window.memory.import(data.memory);
                if (data.discoveries) window.explorer.import(data.discoveries);

                this.updateUI();
                this.viz.updateFromBrain();
                this.renderDiscoveries();

                console.log('[App] Brain imported');
                this.setStatus('Brain imported!', 'idle');
                setTimeout(() => this.setStatus('Ready', 'idle'), 3000);
            } catch (error) {
                console.error('[App] Import failed:', error);
                alert('Failed to import brain state: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Show dreaming overlay animation
     */
    showDreamingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'dreaming-overlay';
        overlay.className = 'dreaming-overlay';
        overlay.innerHTML = `
            <div class="dreaming-content">
                <div class="moon">🌙</div>
                <p>Dreaming...</p>
                <p style="font-size: 0.875rem; color: #a0a0b0; margin-top: 8px;">
                    Replaying memories and finding hidden connections
                </p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Hide dreaming overlay
     */
    hideDreamingOverlay() {
        const overlay = document.getElementById('dreaming-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => overlay.remove(), 300);
        }
    }

    /**
     * Update evolution UI elements
     */
    updateEvolutionUI() {
        if (!window.genetics) return;

        const stats = window.genetics.getStats();

        const genCount = document.getElementById('generation-count');
        const bestFitness = document.getElementById('best-fitness');

        if (genCount) genCount.textContent = stats.generation;
        if (bestFitness) bestFitness.textContent = stats.bestFitness.toFixed(2);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
window.app = new CuriousExplorerApp();
