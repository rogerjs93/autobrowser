/**
 * MEMORY.JS - Human-like Memory Consolidation System
 * Handles short-term to long-term memory transitions
 */

class MemoryConsolidator {
    constructor() {
        this.config = {
            maxShortTermCapacity: 50,
            promotionThreshold: 0.6, // Score needed for long-term promotion
            consolidationInterval: 6 * 60 * 60 * 1000, // 6 hours in ms
            forgettingCurveBase: 0.5, // Ebbinghaus forgetting curve base
            clusterSimilarityThreshold: 0.3,
        };

        this.longTermMemory = [];
        this.topicClusters = new Map(); // clusterName -> [topics]
        this.consolidationHistory = [];

        this.loadLongTermMemory();
    }

    /**
     * Calculate promotion score for an interest (Ebbinghaus-inspired)
     * Higher score = more likely to be promoted to long-term memory
     */
    scoreForPromotion(interest) {
        const MAX_WEIGHT = 1.0;
        const MAX_CONNECTIONS = 10;
        const MAX_ACCESS = 50;
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

        // Weight contribution (30%)
        const weightScore = Math.min(interest.weight / MAX_WEIGHT, 1);

        // Connection strength (30%)
        const connectionScore = Math.min(interest.connections.length / MAX_CONNECTIONS, 1);

        // Access frequency (20%)
        const accessScore = Math.min(Math.log(interest.accessCount + 1) / Math.log(MAX_ACCESS + 1), 1);

        // Recency (20%) - more recent = higher score
        const age = Date.now() - interest.lastActive;
        const recencyScore = Math.max(1 - (age / MAX_AGE), 0);

        // Weighted combination
        const totalScore = (
            (weightScore * 0.30) +
            (connectionScore * 0.30) +
            (accessScore * 0.20) +
            (recencyScore * 0.20)
        );

        return {
            total: totalScore,
            breakdown: {
                weight: weightScore,
                connections: connectionScore,
                access: accessScore,
                recency: recencyScore
            }
        };
    }

    /**
     * Apply Ebbinghaus forgetting curve
     * Memory retention = e^(-t/S) where S is memory strength
     */
    calculateRetention(interest, elapsedTime) {
        // Memory strength increases with access count and connections
        const strength = 1 + (interest.accessCount * 0.1) + (interest.connections.length * 0.2);

        // Time in hours
        const hours = elapsedTime / (60 * 60 * 1000);

        // Retention formula
        return Math.exp(-hours / (strength * 24)); // Decay over days
    }

    /**
     * Consolidate short-term memories to long-term storage
     * This mimics the brain's memory consolidation during sleep
     */
    consolidate() {
        if (!window.brain) {
            console.error('[Memory] Brain not initialized');
            return { promoted: [], forgotten: [] };
        }

        const results = {
            promoted: [],
            forgotten: [],
            clustered: [],
            timestamp: Date.now()
        };

        // Get all short-term interests
        const shortTermInterests = window.brain.getInterestsByType('short-term');

        shortTermInterests.forEach(interest => {
            const score = this.scoreForPromotion(interest);

            if (score.total >= this.config.promotionThreshold) {
                // Promote to long-term memory
                this.promoteToLongTerm(interest);
                results.promoted.push({
                    topic: interest.topic,
                    score: score.total,
                    breakdown: score.breakdown
                });
            } else if (interest.weight < 0.1) {
                // Too weak - will be forgotten by decay
                results.forgotten.push({
                    topic: interest.topic,
                    weight: interest.weight
                });
            }
        });

        // Organize long-term memories into clusters
        this.clusterMemories();
        results.clustered = Array.from(this.topicClusters.keys());

        // Record consolidation event
        this.consolidationHistory.push(results);
        this.saveLongTermMemory();

        console.log(`[Memory] Consolidation complete:`, results);
        return results;
    }

    /**
     * Promote an interest to long-term memory
     */
    promoteToLongTerm(interest) {
        interest.memoryType = 'long-term';
        interest.promotedAt = Date.now();

        // Store in long-term memory array
        const existing = this.longTermMemory.find(m => m.topic === interest.topic);
        if (existing) {
            // Merge with existing long-term memory
            existing.weight = Math.max(existing.weight, interest.weight);
            existing.accessCount += interest.accessCount;
            existing.connections = [...new Set([...existing.connections, ...interest.connections])];
            existing.lastActive = Date.now();
        } else {
            this.longTermMemory.push({
                ...interest,
                memoryType: 'long-term',
                promotedAt: Date.now()
            });
        }
    }

    /**
     * Cluster related memories together (semantic grouping)
     */
    clusterMemories() {
        this.topicClusters.clear();
        const assigned = new Set();

        // Get all long-term memories
        const memories = [...this.longTermMemory];

        memories.forEach(memory => {
            if (assigned.has(memory.topic)) return;

            // Find or create cluster
            let clusterName = this.findBestCluster(memory);

            if (!clusterName) {
                // Create new cluster named after the strongest topic
                clusterName = memory.topic;
                this.topicClusters.set(clusterName, []);
            }

            // Add to cluster
            const cluster = this.topicClusters.get(clusterName);
            cluster.push(memory.topic);
            assigned.add(memory.topic);

            // Add connected topics to same cluster
            memory.connections.forEach(connectedTopic => {
                if (!assigned.has(connectedTopic)) {
                    cluster.push(connectedTopic);
                    assigned.add(connectedTopic);
                }
            });
        });
    }

    /**
     * Find the best existing cluster for a memory
     */
    findBestCluster(memory) {
        let bestCluster = null;
        let bestScore = 0;

        this.topicClusters.forEach((topics, clusterName) => {
            // Calculate average similarity to cluster members
            let totalSimilarity = 0;
            topics.forEach(topic => {
                totalSimilarity += window.brain.calculateSimilarity(memory.topic, topic);
            });

            const avgSimilarity = topics.length > 0 ? totalSimilarity / topics.length : 0;

            if (avgSimilarity > this.config.clusterSimilarityThreshold && avgSimilarity > bestScore) {
                bestScore = avgSimilarity;
                bestCluster = clusterName;
            }
        });

        return bestCluster;
    }

    /**
     * Retrieve memories from long-term storage and restore to brain
     */
    retrieveLongTermMemories() {
        if (!window.brain) return;

        this.longTermMemory.forEach(memory => {
            // Check if already in brain
            if (!window.brain.interests.has(memory.topic)) {
                window.brain.interests.set(memory.topic, {
                    ...memory,
                    lastRetrieved: Date.now()
                });
            }
        });
    }

    /**
     * Get memory capacity status
     */
    getCapacityStatus() {
        const shortTermCount = window.brain ?
            window.brain.getInterestsByType('short-term').length : 0;

        return {
            shortTerm: {
                used: shortTermCount,
                max: this.config.maxShortTermCapacity,
                percentage: (shortTermCount / this.config.maxShortTermCapacity) * 100
            },
            longTerm: {
                count: this.longTermMemory.length,
                clusters: this.topicClusters.size
            }
        };
    }

    /**
     * Get consolidation statistics
     */
    getConsolidationStats() {
        const recentConsolidations = this.consolidationHistory.slice(-10);

        return {
            totalConsolidations: this.consolidationHistory.length,
            lastConsolidation: this.consolidationHistory.length > 0
                ? new Date(this.consolidationHistory[this.consolidationHistory.length - 1].timestamp).toISOString()
                : null,
            averagePromotions: recentConsolidations.length > 0
                ? recentConsolidations.reduce((sum, c) => sum + c.promoted.length, 0) / recentConsolidations.length
                : 0,
            clusters: Array.from(this.topicClusters.entries()).map(([name, topics]) => ({
                name,
                size: topics.length,
                topics: topics
            }))
        };
    }

    /**
     * Save long-term memory to localStorage
     */
    saveLongTermMemory() {
        const data = {
            longTermMemory: this.longTermMemory,
            topicClusters: Array.from(this.topicClusters.entries()),
            consolidationHistory: this.consolidationHistory.slice(-100), // Keep last 100
            savedAt: Date.now()
        };
        localStorage.setItem('curiosity-long-term', JSON.stringify(data));
    }

    /**
     * Load long-term memory from localStorage
     */
    loadLongTermMemory() {
        const saved = localStorage.getItem('curiosity-long-term');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.longTermMemory = data.longTermMemory || [];
                this.topicClusters = new Map(data.topicClusters || []);
                this.consolidationHistory = data.consolidationHistory || [];
                console.log(`[Memory] Loaded ${this.longTermMemory.length} long-term memories`);
            } catch (e) {
                console.error('[Memory] Failed to load long-term memory:', e);
            }
        }
    }

    /**
     * Export memory state for GitHub persistence
     */
    export() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            longTermMemory: this.longTermMemory,
            topicClusters: Array.from(this.topicClusters.entries()),
            consolidationHistory: this.consolidationHistory,
            stats: this.getConsolidationStats()
        };
    }

    /**
     * Import memory state
     */
    import(data) {
        if (data.version !== 1) {
            throw new Error('Incompatible memory state version');
        }

        this.longTermMemory = data.longTermMemory || [];
        this.topicClusters = new Map(data.topicClusters || []);
        this.consolidationHistory = data.consolidationHistory || [];
        this.saveLongTermMemory();

        // Restore to brain
        this.retrieveLongTermMemories();

        console.log(`[Memory] Imported ${this.longTermMemory.length} long-term memories`);
    }

    /**
     * Reset all memory
     */
    reset() {
        this.longTermMemory = [];
        this.topicClusters.clear();
        this.consolidationHistory = [];
        localStorage.removeItem('curiosity-long-term');
        console.log('[Memory] Reset complete');
    }
}

// Export singleton instance
window.memory = new MemoryConsolidator();
