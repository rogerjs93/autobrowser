/**
 * AUTONOMY.JS - Autonomous Decision Engine
 * Makes the explorer self-sufficient - it decides when to explore, dream, and evolve
 */

class AutonomousEngine {
    constructor() {
        this.isRunning = false;
        this.lastActions = {
            explore: 0,
            dream: 0,
            evolve: 0,
            seed: 0
        };

        this.config = {
            // Timing intervals (in ms)
            tickInterval: 10000,          // Decision check every 10 seconds
            exploreInterval: 2 * 60 * 1000,   // Explore every 2 minutes
            dreamInterval: 10 * 60 * 1000,    // Dream every 10 minutes
            evolveInterval: 5 * 60 * 1000,    // Evolve every 5 minutes
            seedInterval: 15 * 60 * 1000,     // Seed new topics every 15 minutes

            // Thresholds
            minInterestsForDream: 3,
            minInterestsForEvolve: 2,
            maxInterests: 30,

            // Autonomous mode
            autoStart: true,
            seedOnEmpty: true
        };

        // Trending topics for self-seeding
        this.trendingTopics = [
            'artificial intelligence', 'machine learning', 'neural networks',
            'quantum computing', 'space exploration', 'climate change',
            'renewable energy', 'biotechnology', 'robotics', 'blockchain',
            'virtual reality', 'augmented reality', 'cybersecurity',
            'gene editing', 'nanotechnology', 'fusion energy',
            'autonomous vehicles', 'brain-computer interface', 'CRISPR',
            'dark matter', 'exoplanets', 'consciousness', 'emergence'
        ];

        // Event callbacks
        this.onAction = null;
        this.onStatusChange = null;

        // Auto-start if configured
        if (this.config.autoStart) {
            setTimeout(() => this.start(), 2000);
        }
    }

    /**
     * Start autonomous operation
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log('[Autonomy] 🤖 Autonomous mode activated');

        if (this.onStatusChange) this.onStatusChange('running');

        // Initial seed if empty
        if (this.config.seedOnEmpty) {
            this.checkAndSeed();
        }

        // Start autonomous tick
        this.tick();
        this.tickTimer = setInterval(() => this.tick(), this.config.tickInterval);
    }

    /**
     * Stop autonomous operation
     */
    stop() {
        this.isRunning = false;
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
        console.log('[Autonomy] 🛑 Autonomous mode deactivated');
        if (this.onStatusChange) this.onStatusChange('stopped');
    }

    /**
     * Main decision tick - evaluates what action to take
     */
    async tick() {
        if (!this.isRunning) return;

        const now = Date.now();
        const decision = this.makeDecision(now);

        if (decision) {
            console.log(`[Autonomy] Decided: ${decision}`);
            await this.executeAction(decision);
        }
    }

    /**
     * Make autonomous decision based on current state and timing
     */
    makeDecision(now) {
        const interests = window.brain?.interests?.size || 0;

        // Priority 1: Seed if empty
        if (interests === 0 && (now - this.lastActions.seed) > 10000) {
            return 'seed';
        }

        // Priority 2: Explore if enough time passed
        if ((now - this.lastActions.explore) > this.config.exploreInterval) {
            if (interests > 0 || Math.random() > 0.5) {
                return 'explore';
            }
        }

        // Priority 3: Dream if conditions met
        if ((now - this.lastActions.dream) > this.config.dreamInterval) {
            if (interests >= this.config.minInterestsForDream) {
                return 'dream';
            }
        }

        // Priority 4: Evolve strategies periodically
        if ((now - this.lastActions.evolve) > this.config.evolveInterval) {
            if (interests >= this.config.minInterestsForEvolve) {
                return 'evolve';
            }
        }

        // Priority 5: Seed new topics to keep growing
        if ((now - this.lastActions.seed) > this.config.seedInterval) {
            if (interests < this.config.maxInterests && Math.random() > 0.7) {
                return 'seed';
            }
        }

        return null;
    }

    /**
     * Execute an autonomous action
     */
    async executeAction(action) {
        const now = Date.now();

        try {
            switch (action) {
                case 'seed':
                    await this.actionSeed();
                    this.lastActions.seed = now;
                    break;

                case 'explore':
                    await this.actionExplore();
                    this.lastActions.explore = now;
                    break;

                case 'dream':
                    await this.actionDream();
                    this.lastActions.dream = now;
                    break;

                case 'evolve':
                    await this.actionEvolve();
                    this.lastActions.evolve = now;
                    break;
            }

            if (this.onAction) {
                this.onAction(action, { success: true });
            }

        } catch (error) {
            console.error(`[Autonomy] Action ${action} failed:`, error);
            if (this.onAction) {
                this.onAction(action, { success: false, error });
            }
        }
    }

    /**
     * Seed new interests from trending topics
     */
    async actionSeed() {
        const interests = window.brain?.interests?.size || 0;
        const count = interests === 0 ? 3 : 1; // Seed 3 if empty, otherwise 1

        const unusedTopics = this.trendingTopics.filter(t =>
            !window.brain?.interests?.has(t)
        );

        if (unusedTopics.length === 0) {
            console.log('[Autonomy] All trending topics already added');
            return;
        }

        // Pick random topics
        const selected = [];
        for (let i = 0; i < Math.min(count, unusedTopics.length); i++) {
            const idx = Math.floor(Math.random() * unusedTopics.length);
            const topic = unusedTopics.splice(idx, 1)[0];
            selected.push(topic);
        }

        // Add to brain
        selected.forEach(topic => {
            window.brain.addInterest(topic, 0.25);
            // Narrate the thought
            window.monologue?.think('seed', { topic });
        });

        console.log(`[Autonomy] 🌱 Seeded: ${selected.join(', ')}`);

        // Update UI
        window.app?.updateUI();
        window.app?.setStatus(`Seeded: ${selected[0]}`, 'idle');
    }

    /**
     * Autonomous exploration using genetic strategy
     */
    async actionExplore() {
        let topic = null;

        // Use genetic strategy if available
        if (window.genetics && window.genetics.population.length > 0) {
            const strategy = window.genetics.selectStrategy();
            const params = window.genetics.applyStrategy(strategy);
            topic = params.selectTopic();

            // Record outcome for fitness
            const beforeDiscoveries = window.explorer?.discoveries?.length || 0;

            await window.explorer.explore(topic);

            const afterDiscoveries = window.explorer?.discoveries?.length || 0;
            window.genetics.recordOutcome(strategy, {
                discoveries: afterDiscoveries - beforeDiscoveries,
                newConnections: 0
            });
        } else {
            // Fallback to regular exploration
            await window.explorer?.explore();
        }

        console.log(`[Autonomy] 🔍 Explored: ${topic || 'random'}`);

        // Narrate exploration
        window.monologue?.think('explore', { topic: topic || 'various topics' });

        // Narrate discoveries
        const recentDiscoveries = window.explorer?.getRecentDiscoveries(1);
        if (recentDiscoveries?.length > 0) {
            window.monologue?.think('discovery', { title: recentDiscoveries[0].title });
        }

        // Update UI
        window.app?.updateUI();
        window.app?.renderDiscoveries();
    }

    /**
     * Autonomous dreaming
     */
    async actionDream() {
        if (!window.dreamer) return;

        console.log('[Autonomy] 💤 Auto-dreaming...');
        window.app?.setStatus('Auto-dreaming...', 'active');

        // Narrate dream start
        window.monologue?.think('dream', {});

        const result = await window.dreamer.dream();

        if (result.success) {
            console.log(`[Autonomy] 💫 Dream found ${result.session.newConnections.length} connections`);
            window.app?.setStatus(`Dream: ${result.session.newConnections.length} links`, 'idle');

            // Narrate dream connections
            result.session.newConnections.forEach(conn => {
                window.monologue?.think('dreamConnection', {
                    topic1: conn.from,
                    topic2: conn.to
                });
            });
        }

        window.app?.updateUI();
        window.app?.viz?.updateFromBrain();
    }

    /**
     * Autonomous evolution
     */
    async actionEvolve() {
        if (!window.genetics) return;

        const beforeGen = window.genetics.generation;
        const result = window.genetics.evolve();

        if (result) {
            console.log(`[Autonomy] 🧬 Evolved to generation ${result.generation}`);
            window.app?.updateEvolutionUI();
            window.app?.setStatus(`Gen ${result.generation} evolved`, 'idle');

            // Narrate evolution
            window.monologue?.think('evolve', { gen: result.generation });
        }
    }

    /**
     * Check if we need to seed and do it
     */
    checkAndSeed() {
        const interests = window.brain?.interests?.size || 0;
        if (interests === 0) {
            this.actionSeed();
        }
    }

    /**
     * Get autonomy statistics
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            lastActions: { ...this.lastActions },
            uptime: this.isRunning ? Date.now() - (this.startTime || Date.now()) : 0,
            config: { ...this.config }
        };
    }

    /**
     * Update configuration
     */
    setConfig(newConfig) {
        Object.assign(this.config, newConfig);
        console.log('[Autonomy] Config updated:', this.config);
    }
}

// Export singleton instance
window.autonomy = new AutonomousEngine();
