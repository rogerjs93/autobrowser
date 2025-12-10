/**
 * DREAMER.JS - Dream Replay System
 * Simulates brain's "sleep" consolidation by replaying memory chains
 * and discovering hidden connections between distant topics
 */

class DreamReplaySystem {
    constructor() {
        this.dreamLog = [];
        this.discoveredConnections = [];
        this.isDreaming = false;

        this.config = {
            replayChainLength: 5,      // How many memories to chain together
            chainsPerDream: 10,        // How many chains to replay per dream session
            connectionThreshold: 0.15,  // Min similarity to create dream connection
            serendipityBoost: 0.3,     // Bonus weight for dream-discovered connections
            dreamDuration: 5000,       // Animation duration in ms
        };

        // Event callbacks
        this.onDreamStart = null;
        this.onDreamEnd = null;
        this.onConnectionDiscovered = null;
        this.onDreamVisualization = null;
    }

    /**
     * Start a dream session - replay memories and find hidden connections
     * This mimics how the brain consolidates memories during REM sleep
     */
    async dream() {
        if (this.isDreaming || !window.brain) {
            return { success: false, reason: 'Already dreaming or brain not initialized' };
        }

        this.isDreaming = true;
        if (this.onDreamStart) this.onDreamStart();

        const dreamSession = {
            startTime: Date.now(),
            chains: [],
            newConnections: [],
            strengthenedConnections: [],
            insights: []
        };

        const interests = Array.from(window.brain.interests.values());

        if (interests.length < 3) {
            this.isDreaming = false;
            return { success: false, reason: 'Need at least 3 interests to dream' };
        }

        console.log('[Dreamer] 💤 Starting dream session...');

        // Generate random memory chains
        for (let i = 0; i < this.config.chainsPerDream; i++) {
            const chain = this.generateMemoryChain(interests);
            dreamSession.chains.push(chain);

            // Visualize the chain being replayed
            if (this.onDreamVisualization) {
                await this.onDreamVisualization(chain, i);
                await this.sleep(this.config.dreamDuration / this.config.chainsPerDream);
            }

            // Analyze chain for hidden connections
            const connections = this.analyzeChainForConnections(chain);

            for (const conn of connections) {
                if (this.isNewConnection(conn.from, conn.to)) {
                    // Create the new connection in the brain
                    this.createDreamConnection(conn.from, conn.to, conn.similarity);
                    dreamSession.newConnections.push(conn);

                    if (this.onConnectionDiscovered) {
                        this.onConnectionDiscovered(conn);
                    }
                } else {
                    // Strengthen existing connection
                    this.strengthenConnection(conn.from, conn.to);
                    dreamSession.strengthenedConnections.push(conn);
                }
            }
        }

        // Generate dream insights (creative associations)
        dreamSession.insights = this.generateInsights(dreamSession.chains);

        // Record the dream
        dreamSession.endTime = Date.now();
        dreamSession.duration = dreamSession.endTime - dreamSession.startTime;
        this.dreamLog.push(dreamSession);

        // Save dream results
        this.saveDreamLog();
        window.brain.save();

        this.isDreaming = false;
        if (this.onDreamEnd) this.onDreamEnd(dreamSession);

        console.log('[Dreamer] 🌅 Dream complete:', {
            chains: dreamSession.chains.length,
            newConnections: dreamSession.newConnections.length,
            insights: dreamSession.insights.length
        });

        return { success: true, session: dreamSession };
    }

    /**
     * Generate a random memory chain by walking through connected and unconnected memories
     * This mimics the random-seeming nature of dreams
     */
    generateMemoryChain(interests) {
        const chain = [];
        const used = new Set();

        // Start with a random memory
        let current = interests[Math.floor(Math.random() * interests.length)];
        chain.push(current);
        used.add(current.topic);

        for (let i = 1; i < this.config.replayChainLength; i++) {
            let next = null;

            // 60% chance: follow a connection (if available)
            // 40% chance: random jump (like dream logic)
            if (Math.random() < 0.6 && current.connections.length > 0) {
                // Follow a connection
                const available = current.connections.filter(t => !used.has(t));
                if (available.length > 0) {
                    const nextTopic = available[Math.floor(Math.random() * available.length)];
                    next = window.brain.interests.get(nextTopic);
                }
            }

            // Random jump if no connection followed
            if (!next) {
                const available = interests.filter(i => !used.has(i.topic));
                if (available.length > 0) {
                    next = available[Math.floor(Math.random() * available.length)];
                }
            }

            if (next) {
                chain.push(next);
                used.add(next.topic);
                current = next;
            } else {
                break;
            }
        }

        return chain;
    }

    /**
     * Analyze a memory chain for hidden connections between non-adjacent memories
     */
    analyzeChainForConnections(chain) {
        const potentialConnections = [];

        // Look for connections between non-adjacent memories in the chain
        for (let i = 0; i < chain.length - 2; i++) {
            for (let j = i + 2; j < chain.length; j++) {
                const topicA = chain[i];
                const topicB = chain[j];

                // Calculate similarity using keyword overlap + semantic analysis
                const similarity = this.calculateDreamSimilarity(topicA, topicB);

                if (similarity >= this.config.connectionThreshold) {
                    potentialConnections.push({
                        from: topicA.topic,
                        to: topicB.topic,
                        similarity,
                        distance: j - i,
                        discoveredAt: Date.now(),
                        type: 'dream'
                    });
                }
            }
        }

        return potentialConnections;
    }

    /**
     * Calculate similarity with dream-logic (more lenient, finds unexpected connections)
     */
    calculateDreamSimilarity(interestA, interestB) {
        // Keyword overlap
        const keywordsA = new Set(interestA.keywords || this.extractKeywords(interestA.topic));
        const keywordsB = new Set(interestB.keywords || this.extractKeywords(interestB.topic));

        let keywordSimilarity = 0;
        if (keywordsA.size > 0 && keywordsB.size > 0) {
            const intersection = [...keywordsA].filter(k => keywordsB.has(k)).length;
            const union = new Set([...keywordsA, ...keywordsB]).size;
            keywordSimilarity = intersection / union;
        }

        // Shared connections (friends of friends)
        const connectionsA = new Set(interestA.connections);
        const connectionsB = new Set(interestB.connections);
        let sharedConnections = 0;
        connectionsA.forEach(c => {
            if (connectionsB.has(c)) sharedConnections++;
        });
        const connectionSimilarity = sharedConnections / Math.max(1, Math.min(connectionsA.size, connectionsB.size));

        // Co-occurrence in discoveries
        let discoveryCooccurrence = 0;
        if (window.explorer && window.explorer.discoveries) {
            const discoveries = window.explorer.discoveries;
            const topicAInDiscoveries = discoveries.filter(d =>
                d.keywords?.includes(interestA.topic.toLowerCase()) ||
                d.searchTopic === interestA.topic
            ).map(d => d.id);
            const topicBInDiscoveries = discoveries.filter(d =>
                d.keywords?.includes(interestB.topic.toLowerCase()) ||
                d.searchTopic === interestB.topic
            ).map(d => d.id);

            const sharedDiscoveries = topicAInDiscoveries.filter(id =>
                topicBInDiscoveries.includes(id)
            ).length;
            discoveryCooccurrence = sharedDiscoveries > 0 ? 0.3 : 0;
        }

        // Combine with dream-logic weighting (more lenient)
        return (keywordSimilarity * 0.4) +
            (connectionSimilarity * 0.3) +
            (discoveryCooccurrence * 0.2) +
            (Math.random() * 0.1); // Dream randomness
    }

    /**
     * Extract keywords from topic
     */
    extractKeywords(topic) {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of']);
        return topic.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }

    /**
     * Check if connection between two topics is new
     */
    isNewConnection(topicA, topicB) {
        const interest = window.brain.interests.get(topicA);
        if (!interest) return true;
        return !interest.connections.includes(topicB);
    }

    /**
     * Create a new connection discovered through dreaming
     */
    createDreamConnection(topicA, topicB, similarity) {
        const interestA = window.brain.interests.get(topicA);
        const interestB = window.brain.interests.get(topicB);

        if (!interestA || !interestB) return;

        // Add bidirectional connection
        if (!interestA.connections.includes(topicB)) {
            interestA.connections.push(topicB);
        }
        if (!interestB.connections.includes(topicA)) {
            interestB.connections.push(topicA);
        }

        // Boost both interests slightly (dream reinforcement)
        interestA.weight = Math.min(interestA.weight + this.config.serendipityBoost * 0.5, 1.0);
        interestB.weight = Math.min(interestB.weight + this.config.serendipityBoost * 0.5, 1.0);

        // Mark as dream-discovered
        interestA.dreamConnections = interestA.dreamConnections || [];
        interestA.dreamConnections.push({ topic: topicB, discoveredAt: Date.now() });

        // Store in global discovered connections
        this.discoveredConnections.push({
            from: topicA,
            to: topicB,
            similarity,
            discoveredAt: Date.now()
        });

        console.log(`[Dreamer] 💫 Dream connection discovered: "${topicA}" ↔ "${topicB}"`);
    }

    /**
     * Strengthen an existing connection found through dream replay
     */
    strengthenConnection(topicA, topicB) {
        const interestA = window.brain.interests.get(topicA);
        const interestB = window.brain.interests.get(topicB);

        if (interestA && interestB) {
            interestA.weight = Math.min(interestA.weight + 0.05, 1.0);
            interestB.weight = Math.min(interestB.weight + 0.05, 1.0);
        }
    }

    /**
     * Generate creative insights from dream chains
     */
    generateInsights(chains) {
        const insights = [];

        // Find topics that appear in multiple chains (dream themes)
        const topicFrequency = new Map();
        chains.forEach(chain => {
            chain.forEach(interest => {
                topicFrequency.set(
                    interest.topic,
                    (topicFrequency.get(interest.topic) || 0) + 1
                );
            });
        });

        // Topics appearing in multiple chains are "dream themes"
        topicFrequency.forEach((count, topic) => {
            if (count >= 2) {
                insights.push({
                    type: 'theme',
                    topic,
                    frequency: count,
                    message: `"${topic}" appeared in ${count} dream sequences - this may be a core interest`
                });
            }
        });

        // Find unexpected bridges (topics connecting distant interests)
        chains.forEach(chain => {
            if (chain.length >= 4) {
                const first = chain[0];
                const last = chain[chain.length - 1];
                const bridge = chain[Math.floor(chain.length / 2)];

                insights.push({
                    type: 'bridge',
                    from: first.topic,
                    to: last.topic,
                    bridge: bridge.topic,
                    message: `"${bridge.topic}" may connect "${first.topic}" to "${last.topic}"`
                });
            }
        });

        return insights.slice(0, 5); // Limit insights
    }

    /**
     * Helper sleep function for visualization timing
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get dream statistics
     */
    getStats() {
        return {
            totalDreams: this.dreamLog.length,
            totalConnectionsDiscovered: this.discoveredConnections.length,
            lastDream: this.dreamLog.length > 0
                ? new Date(this.dreamLog[this.dreamLog.length - 1].endTime).toISOString()
                : null,
            averageConnectionsPerDream: this.dreamLog.length > 0
                ? this.dreamLog.reduce((sum, d) => sum + d.newConnections.length, 0) / this.dreamLog.length
                : 0
        };
    }

    /**
     * Save dream log to localStorage
     */
    saveDreamLog() {
        const data = {
            dreamLog: this.dreamLog.slice(-50), // Keep last 50 dreams
            discoveredConnections: this.discoveredConnections.slice(-100),
            savedAt: Date.now()
        };
        localStorage.setItem('curiosity-dreams', JSON.stringify(data));
    }

    /**
     * Load dream log from localStorage
     */
    loadDreamLog() {
        const saved = localStorage.getItem('curiosity-dreams');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.dreamLog = data.dreamLog || [];
                this.discoveredConnections = data.discoveredConnections || [];
                console.log(`[Dreamer] Loaded ${this.dreamLog.length} dream sessions`);
            } catch (e) {
                console.error('[Dreamer] Failed to load dream log:', e);
            }
        }
    }

    /**
     * Export dream data
     */
    export() {
        return {
            dreamLog: this.dreamLog,
            discoveredConnections: this.discoveredConnections,
            stats: this.getStats()
        };
    }

    /**
     * Reset dream data
     */
    reset() {
        this.dreamLog = [];
        this.discoveredConnections = [];
        localStorage.removeItem('curiosity-dreams');
    }
}

// Export singleton instance
window.dreamer = new DreamReplaySystem();
