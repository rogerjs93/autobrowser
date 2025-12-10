/**
 * SUGGESTIONS.JS - Content Suggestion System
 * Recommends content based on interests with serendipity factor
 */

class SuggestionEngine {
    constructor() {
        this.suggestions = [];
        this.suggestionHistory = [];

        this.config = {
            maxSuggestions: 10,
            serendipityFactor: 0.2, // 20% chance of unexpected suggestion
            refreshInterval: 5 * 60 * 1000, // 5 minutes
        };

        // Event callbacks
        this.onSuggestionsUpdated = null;
    }

    /**
     * Generate suggestions based on current interests
     */
    async generateSuggestions() {
        if (!window.brain || !window.explorer) {
            console.warn('[Suggestions] Brain or Explorer not initialized');
            return [];
        }

        const interests = window.brain.getInterestsSorted();
        const discoveries = window.explorer.getRecentDiscoveries(50);

        if (interests.length === 0 && discoveries.length === 0) {
            return this.getDefaultSuggestions();
        }

        const suggestions = [];

        // 1. Interest-based suggestions (from discoveries)
        interests.slice(0, 5).forEach(interest => {
            const relatedDiscoveries = this.findRelatedDiscoveries(interest.topic, discoveries);
            relatedDiscoveries.forEach(discovery => {
                suggestions.push({
                    type: 'discovery',
                    topic: discovery.title,
                    reason: `Based on your interest in "${interest.topic}"`,
                    score: this.calculateSuggestionScore(discovery, interest),
                    source: discovery.source,
                    url: discovery.url,
                    discoveryId: discovery.id
                });
            });
        });

        // 2. Connection-based suggestions (explore connections)
        interests.slice(0, 3).forEach(interest => {
            interest.connections.forEach(connectedTopic => {
                if (!suggestions.some(s => s.topic.toLowerCase() === connectedTopic)) {
                    suggestions.push({
                        type: 'explore',
                        topic: connectedTopic,
                        reason: `Connected to "${interest.topic}"`,
                        score: 0.6 + (Math.random() * 0.2),
                        source: 'Connection',
                        action: 'explore'
                    });
                }
            });
        });

        // 3. Serendipity suggestions (unexpected discoveries)
        if (Math.random() < this.config.serendipityFactor && discoveries.length > 0) {
            const randomDiscovery = discoveries[Math.floor(Math.random() * discoveries.length)];
            suggestions.push({
                type: 'serendipity',
                topic: randomDiscovery.title,
                reason: 'Unexpected discovery ✨',
                score: 0.7 + (Math.random() * 0.3),
                source: randomDiscovery.source,
                url: randomDiscovery.url,
                discoveryId: randomDiscovery.id
            });
        }

        // 4. Topic expansion suggestions
        const topInterest = interests[0];
        if (topInterest) {
            const expansions = this.generateTopicExpansions(topInterest.topic);
            expansions.forEach(expansion => {
                suggestions.push({
                    type: 'expansion',
                    topic: expansion,
                    reason: `Expand from "${topInterest.topic}"`,
                    score: 0.5 + (Math.random() * 0.3),
                    source: 'Expansion',
                    action: 'explore'
                });
            });
        }

        // Sort by score and deduplicate
        const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
        const sorted = uniqueSuggestions.sort((a, b) => b.score - a.score);

        this.suggestions = sorted.slice(0, this.config.maxSuggestions);

        if (this.onSuggestionsUpdated) {
            this.onSuggestionsUpdated(this.suggestions);
        }

        return this.suggestions;
    }

    /**
     * Find discoveries related to a topic
     */
    findRelatedDiscoveries(topic, discoveries) {
        const topicWords = new Set(topic.toLowerCase().split(/\s+/));

        return discoveries.filter(discovery => {
            const titleWords = discovery.title.toLowerCase().split(/\s+/);
            return titleWords.some(word => topicWords.has(word)) ||
                discovery.keywords.some(kw => topicWords.has(kw));
        }).slice(0, 3);
    }

    /**
     * Calculate suggestion score
     */
    calculateSuggestionScore(discovery, interest) {
        const relevance = discovery.relevance || 0;
        const interestWeight = interest.weight || 0.5;
        const recency = 1 - (Date.now() - discovery.discoveredAt) / (7 * 24 * 60 * 60 * 1000);

        return (relevance * 0.4) + (interestWeight * 0.4) + (Math.max(recency, 0) * 0.2);
    }

    /**
     * Generate topic expansion suggestions
     */
    generateTopicExpansions(topic) {
        const expansions = [];
        const prefixes = ['advanced', 'introduction to', 'history of', 'future of'];
        const suffixes = ['applications', 'research', 'innovations', 'breakthroughs'];

        // Add prefix expansion
        if (Math.random() > 0.5) {
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            expansions.push(`${prefix} ${topic}`);
        }

        // Add suffix expansion
        if (Math.random() > 0.5) {
            const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
            expansions.push(`${topic} ${suffix}`);
        }

        return expansions.slice(0, 2);
    }

    /**
     * Deduplicate suggestions by topic
     */
    deduplicateSuggestions(suggestions) {
        const seen = new Set();
        return suggestions.filter(s => {
            const key = s.topic.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Get default suggestions for new users
     */
    getDefaultSuggestions() {
        const defaults = [
            { topic: 'Artificial Intelligence', reason: 'Popular topic', source: 'Default' },
            { topic: 'Space Exploration', reason: 'Trending subject', source: 'Default' },
            { topic: 'Quantum Computing', reason: 'Emerging technology', source: 'Default' },
            { topic: 'Climate Science', reason: 'Important field', source: 'Default' },
            { topic: 'Neuroscience', reason: 'Fascinating discoveries', source: 'Default' }
        ];

        return defaults.map((d, i) => ({
            ...d,
            type: 'default',
            score: 0.5 - (i * 0.05),
            action: 'add'
        }));
    }

    /**
     * Handle suggestion click
     */
    async handleSuggestionClick(suggestion) {
        this.suggestionHistory.push({
            suggestion,
            clickedAt: Date.now()
        });

        if (suggestion.action === 'explore' && window.explorer) {
            await window.explorer.explore(suggestion.topic);
        } else if (suggestion.action === 'add' && window.brain) {
            window.brain.addInterest(suggestion.topic, 0.3);
        } else if (suggestion.url) {
            window.open(suggestion.url, '_blank');
        }

        // Refresh suggestions after action
        setTimeout(() => this.generateSuggestions(), 500);
    }

    /**
     * Get current suggestions
     */
    getSuggestions() {
        return this.suggestions;
    }

    /**
     * Export suggestion data
     */
    export() {
        return {
            suggestions: this.suggestions,
            history: this.suggestionHistory.slice(-50)
        };
    }
}

// Export singleton instance
window.suggestions = new SuggestionEngine();
