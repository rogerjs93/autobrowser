/**
 * BRAIN.JS - Core Curiosity Engine
 * Manages interests with decay, reinforcement, and connections
 */

class CuriosityEngine {
    constructor() {
        this.interests = new Map(); // topic -> InterestNode
        this.connections = []; // Array of {from, to, strength}
        
        // Configuration
        this.config = {
            decayRate: 0.0001, // Per millisecond decay rate
            decayInterval: 60000, // Run decay every minute
            reinforcementFactor: 0.3, // How much connected interests gain
            connectionThreshold: 0.2, // Min similarity to create connection
            coreThreshold: 0.7, // Weight threshold to become core interest
            maxShortTermInterests: 50,
            initialWeight: 0.5,
            maxWeight: 1.0,
            minWeight: 0.05, // Below this, interest is forgotten
        };
        
        // Event callbacks
        this.onInterestAdded = null;
        this.onInterestUpdated = null;
        this.onInterestRemoved = null;
        this.onConnectionCreated = null;
        
        // Start decay loop
        this.startDecayLoop();
    }
    
    /**
     * Create an interest node
     */
    createInterestNode(topic, weight = null) {
        return {
            topic: topic.toLowerCase().trim(),
            weight: weight || this.config.initialWeight,
            connections: [],
            lastActive: Date.now(),
            createdAt: Date.now(),
            accessCount: 1,
            isCore: false,
            memoryType: 'short-term', // 'short-term', 'long-term', 'core'
            keywords: this.extractKeywords(topic),
        };
    }
    
    /**
     * Extract keywords from a topic for similarity matching
     */
    extractKeywords(topic) {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        return topic.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }
    
    /**
     * Calculate similarity between two topics based on keywords
     */
    calculateSimilarity(topic1, topic2) {
        const keywords1 = new Set(this.extractKeywords(topic1));
        const keywords2 = new Set(this.extractKeywords(topic2));
        
        if (keywords1.size === 0 || keywords2.size === 0) return 0;
        
        const intersection = [...keywords1].filter(k => keywords2.has(k)).length;
        const union = new Set([...keywords1, ...keywords2]).size;
        
        // Jaccard similarity
        return intersection / union;
    }
    
    /**
     * Add or reinforce an interest
     */
    addInterest(topic, strength = 0.1) {
        const normalizedTopic = topic.toLowerCase().trim();
        
        if (this.interests.has(normalizedTopic)) {
            // Reinforce existing interest
            this.reinforceInterest(normalizedTopic, strength);
        } else {
            // Create new interest
            if (this.interests.size >= this.config.maxShortTermInterests) {
                // Remove weakest interest to make room
                this.removeWeakestInterest();
            }
            
            const node = this.createInterestNode(topic);
            this.interests.set(normalizedTopic, node);
            
            // Find and create connections to related interests
            this.findAndCreateConnections(normalizedTopic);
            
            if (this.onInterestAdded) {
                this.onInterestAdded(node);
            }
        }
        
        this.updateCoreStatus();
        this.save();
        
        return this.interests.get(normalizedTopic);
    }
    
    /**
     * Reinforce an existing interest
     */
    reinforceInterest(topic, strength = 0.1) {
        const node = this.interests.get(topic);
        if (!node) return;
        
        // Increase weight (capped at max)
        node.weight = Math.min(node.weight + strength, this.config.maxWeight);
        node.lastActive = Date.now();
        node.accessCount++;
        
        // Reinforce connected interests (weaker effect)
        node.connections.forEach(connectedTopic => {
            const connected = this.interests.get(connectedTopic);
            if (connected) {
                connected.weight = Math.min(
                    connected.weight + strength * this.config.reinforcementFactor,
                    this.config.maxWeight
                );
                connected.lastActive = Date.now();
            }
        });
        
        if (this.onInterestUpdated) {
            this.onInterestUpdated(node);
        }
    }
    
    /**
     * Find related interests and create connections
     */
    findAndCreateConnections(topic) {
        const node = this.interests.get(topic);
        if (!node) return;
        
        this.interests.forEach((otherNode, otherTopic) => {
            if (otherTopic === topic) return;
            
            const similarity = this.calculateSimilarity(topic, otherTopic);
            
            if (similarity >= this.config.connectionThreshold) {
                // Create bidirectional connection
                if (!node.connections.includes(otherTopic)) {
                    node.connections.push(otherTopic);
                }
                if (!otherNode.connections.includes(topic)) {
                    otherNode.connections.push(topic);
                }
                
                // Store connection with strength
                this.connections.push({
                    from: topic,
                    to: otherTopic,
                    strength: similarity,
                    createdAt: Date.now()
                });
                
                // Reinforce the related interest (prevents decay via relation)
                otherNode.weight = Math.min(
                    otherNode.weight + 0.05,
                    this.config.maxWeight
                );
                
                if (this.onConnectionCreated) {
                    this.onConnectionCreated({ from: topic, to: otherTopic, strength: similarity });
                }
            }
        });
    }
    
    /**
     * Apply decay to all interests
     */
    applyDecay() {
        const now = Date.now();
        const toRemove = [];
        
        this.interests.forEach((node, topic) => {
            // Core interests decay slower
            const decayMultiplier = node.isCore ? 0.1 : 1.0;
            
            // Long-term memories decay slower than short-term
            const memoryMultiplier = node.memoryType === 'long-term' ? 0.3 : 1.0;
            
            const age = now - node.lastActive;
            const decayAmount = this.config.decayRate * age * decayMultiplier * memoryMultiplier;
            
            node.weight = Math.max(node.weight - decayAmount, 0);
            
            if (node.weight < this.config.minWeight) {
                toRemove.push(topic);
            }
        });
        
        // Remove forgotten interests
        toRemove.forEach(topic => {
            this.removeInterest(topic);
        });
        
        this.updateCoreStatus();
    }
    
    /**
     * Start the decay loop
     */
    startDecayLoop() {
        setInterval(() => {
            this.applyDecay();
            this.save();
        }, this.config.decayInterval);
    }
    
    /**
     * Update core status based on weight threshold
     */
    updateCoreStatus() {
        this.interests.forEach((node) => {
            const wasCore = node.isCore;
            node.isCore = node.weight >= this.config.coreThreshold;
            
            if (node.isCore && !wasCore) {
                node.memoryType = 'core';
            } else if (!node.isCore && node.memoryType === 'core') {
                node.memoryType = 'long-term';
            }
        });
    }
    
    /**
     * Remove an interest
     */
    removeInterest(topic) {
        const node = this.interests.get(topic);
        if (!node) return;
        
        // Remove connections
        node.connections.forEach(connectedTopic => {
            const connected = this.interests.get(connectedTopic);
            if (connected) {
                connected.connections = connected.connections.filter(t => t !== topic);
            }
        });
        
        // Remove from connections array
        this.connections = this.connections.filter(
            c => c.from !== topic && c.to !== topic
        );
        
        this.interests.delete(topic);
        
        if (this.onInterestRemoved) {
            this.onInterestRemoved(node);
        }
    }
    
    /**
     * Remove the weakest interest
     */
    removeWeakestInterest() {
        let weakest = null;
        let minWeight = Infinity;
        
        this.interests.forEach((node, topic) => {
            // Don't remove core interests
            if (!node.isCore && node.weight < minWeight) {
                minWeight = node.weight;
                weakest = topic;
            }
        });
        
        if (weakest) {
            this.removeInterest(weakest);
        }
    }
    
    /**
     * Get all interests sorted by weight
     */
    getInterestsSorted() {
        return Array.from(this.interests.values())
            .sort((a, b) => b.weight - a.weight);
    }
    
    /**
     * Get top interests
     */
    getTopInterests(count = 5) {
        return this.getInterestsSorted().slice(0, count);
    }
    
    /**
     * Get interests by memory type
     */
    getInterestsByType(type) {
        return Array.from(this.interests.values())
            .filter(node => node.memoryType === type);
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const interests = Array.from(this.interests.values());
        return {
            shortTerm: interests.filter(i => i.memoryType === 'short-term').length,
            longTerm: interests.filter(i => i.memoryType === 'long-term').length,
            core: interests.filter(i => i.isCore).length,
            total: interests.length,
            connections: this.connections.length,
            averageWeight: interests.length > 0 
                ? interests.reduce((sum, i) => sum + i.weight, 0) / interests.length 
                : 0
        };
    }
    
    /**
     * Save to localStorage
     */
    save() {
        const data = {
            interests: Array.from(this.interests.entries()),
            connections: this.connections,
            savedAt: Date.now()
        };
        localStorage.setItem('curiosity-brain', JSON.stringify(data));
    }
    
    /**
     * Load from localStorage
     */
    load() {
        const saved = localStorage.getItem('curiosity-brain');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.interests = new Map(data.interests);
                this.connections = data.connections || [];
                console.log(`[Brain] Loaded ${this.interests.size} interests`);
            } catch (e) {
                console.error('[Brain] Failed to load saved data:', e);
            }
        }
    }
    
    /**
     * Export brain state as JSON
     */
    export() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            interests: Array.from(this.interests.entries()),
            connections: this.connections,
            stats: this.getStats()
        };
    }
    
    /**
     * Import brain state from JSON
     */
    import(data) {
        if (data.version !== 1) {
            throw new Error('Incompatible brain state version');
        }
        
        this.interests = new Map(data.interests);
        this.connections = data.connections || [];
        this.save();
        
        console.log(`[Brain] Imported ${this.interests.size} interests`);
    }
    
    /**
     * Reset all data
     */
    reset() {
        this.interests.clear();
        this.connections = [];
        localStorage.removeItem('curiosity-brain');
        console.log('[Brain] Reset complete');
    }
}

// Export singleton instance
window.brain = new CuriosityEngine();
