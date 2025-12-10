/**
 * EXPLORER.JS - Autonomous Exploration Engine
 * Fetches content from multiple free APIs with fallback logic
 */

class AutonomousExplorer {
    constructor() {
        this.discoveries = [];
        this.explorationLog = [];
        this.isExploring = false;

        // API configurations
        this.apis = {
            wikipedia: {
                name: 'Wikipedia',
                baseUrl: 'https://en.wikipedia.org/api/rest_v1',
                searchUrl: 'https://en.wikipedia.org/w/api.php',
                enabled: true,
                priority: 1
            },
            hackerNews: {
                name: 'Hacker News',
                baseUrl: 'https://hacker-news.firebaseio.com/v0',
                enabled: true,
                priority: 2
            },
            reddit: {
                name: 'Reddit',
                baseUrl: 'https://www.reddit.com',
                enabled: true,
                priority: 3,
                rateLimit: 1000 // ms between requests
            },
            openLibrary: {
                name: 'Open Library',
                baseUrl: 'https://openlibrary.org',
                enabled: true,
                priority: 5
            }
        };

        // Event callbacks
        this.onDiscovery = null;
        this.onExplorationStart = null;
        this.onExplorationEnd = null;
        this.onError = null;

        this.loadDiscoveries();
    }

    /**
     * Main exploration function with fallback logic
     */
    async explore(topic = null) {
        if (this.isExploring) {
            console.log('[Explorer] Already exploring...');
            return null;
        }

        this.isExploring = true;
        if (this.onExplorationStart) this.onExplorationStart();

        try {
            // If no topic provided, use a random top interest
            if (!topic && window.brain) {
                const topInterests = window.brain.getTopInterests(5);
                if (topInterests.length > 0) {
                    topic = topInterests[Math.floor(Math.random() * topInterests.length)].topic;
                } else {
                    // Random exploration
                    topic = this.getRandomTopic();
                }
            }

            console.log(`[Explorer] Exploring: ${topic}`);

            // Try APIs in priority order
            const sortedApis = Object.entries(this.apis)
                .filter(([_, config]) => config.enabled)
                .sort((a, b) => a[1].priority - b[1].priority);

            for (const [apiName, config] of sortedApis) {
                try {
                    const results = await this.fetchFromApi(apiName, topic);

                    if (results && results.length > 0) {
                        // Process discoveries
                        const processed = this.processResults(results, apiName, topic);
                        this.addDiscoveries(processed);

                        this.logExploration(topic, apiName, 'success', processed.length);

                        console.log(`[Explorer] Found ${processed.length} discoveries from ${config.name}`);
                        return processed;
                    }
                } catch (error) {
                    console.warn(`[Explorer] ${config.name} failed:`, error.message);
                    this.logExploration(topic, apiName, 'error', 0, error.message);
                }
            }

            console.log('[Explorer] All APIs exhausted, no results found');
            return [];

        } finally {
            this.isExploring = false;
            if (this.onExplorationEnd) this.onExplorationEnd();
        }
    }

    /**
     * Fetch from a specific API
     */
    async fetchFromApi(apiName, topic) {
        switch (apiName) {
            case 'wikipedia':
                return await this.fetchWikipedia(topic);
            case 'hackerNews':
                return await this.fetchHackerNews(topic);
            case 'reddit':
                return await this.fetchReddit(topic);
            case 'openLibrary':
                return await this.fetchOpenLibrary(topic);
            default:
                throw new Error(`Unknown API: ${apiName}`);
        }
    }

    /**
     * Fetch from Wikipedia API
     */
    async fetchWikipedia(topic) {
        const searchParams = new URLSearchParams({
            action: 'query',
            list: 'search',
            srsearch: topic,
            srlimit: 5,
            format: 'json',
            origin: '*'
        });

        const response = await fetch(`${this.apis.wikipedia.searchUrl}?${searchParams}`);
        if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);

        const data = await response.json();

        if (!data.query || !data.query.search) return [];

        return data.query.search.map(item => ({
            title: item.title,
            description: this.stripHtml(item.snippet),
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            source: 'Wikipedia',
            type: 'article',
            relevance: this.calculateRelevance(item.title, topic)
        }));
    }

    /**
     * Fetch from Hacker News API
     */
    async fetchHackerNews(topic) {
        // Search using Algolia HN Search API
        const response = await fetch(
            `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=5`
        );
        if (!response.ok) throw new Error(`HN HTTP ${response.status}`);

        const data = await response.json();

        if (!data.hits) return [];

        return data.hits.map(item => ({
            title: item.title,
            description: item.author ? `by ${item.author} • ${item.points} points` : '',
            url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
            source: 'Hacker News',
            type: 'story',
            relevance: this.calculateRelevance(item.title, topic),
            metadata: {
                points: item.points,
                comments: item.num_comments,
                author: item.author
            }
        }));
    }

    /**
     * Fetch from Reddit API (public, no auth)
     */
    async fetchReddit(topic) {
        const response = await fetch(
            `${this.apis.reddit.baseUrl}/search.json?q=${encodeURIComponent(topic)}&limit=5&sort=relevance`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!response.ok) throw new Error(`Reddit HTTP ${response.status}`);

        const data = await response.json();

        if (!data.data || !data.data.children) return [];

        return data.data.children
            .filter(item => item.kind === 't3') // Only posts
            .map(item => ({
                title: item.data.title,
                description: `r/${item.data.subreddit} • ${item.data.score} upvotes`,
                url: `https://reddit.com${item.data.permalink}`,
                source: 'Reddit',
                type: 'post',
                relevance: this.calculateRelevance(item.data.title, topic),
                metadata: {
                    subreddit: item.data.subreddit,
                    score: item.data.score,
                    comments: item.data.num_comments
                }
            }));
    }

    /**
     * Fetch from Open Library API
     */
    async fetchOpenLibrary(topic) {
        const response = await fetch(
            `${this.apis.openLibrary.baseUrl}/search.json?q=${encodeURIComponent(topic)}&limit=5`
        );
        if (!response.ok) throw new Error(`OpenLibrary HTTP ${response.status}`);

        const data = await response.json();

        if (!data.docs) return [];

        return data.docs.slice(0, 5).map(item => ({
            title: item.title,
            description: item.author_name ? `by ${item.author_name.join(', ')}` : 'Unknown author',
            url: `https://openlibrary.org${item.key}`,
            source: 'Open Library',
            type: 'book',
            relevance: this.calculateRelevance(item.title, topic),
            metadata: {
                author: item.author_name,
                publishYear: item.first_publish_year,
                subjects: item.subject?.slice(0, 5)
            }
        }));
    }

    /**
     * Calculate relevance score between result and search topic
     */
    calculateRelevance(title, topic) {
        if (!title || !topic) return 0;

        const titleWords = new Set(title.toLowerCase().split(/\s+/));
        const topicWords = topic.toLowerCase().split(/\s+/);

        let matches = 0;
        topicWords.forEach(word => {
            if (titleWords.has(word)) matches++;
        });

        return topicWords.length > 0 ? matches / topicWords.length : 0;
    }

    /**
     * Strip HTML tags from text
     */
    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    /**
     * Process and enrich results
     */
    processResults(results, apiName, searchTopic) {
        return results.map(result => ({
            ...result,
            id: this.generateId(),
            discoveredAt: Date.now(),
            searchTopic,
            keywords: this.extractKeywords(result.title),
            processed: true
        }));
    }

    /**
     * Extract keywords from title
     */
    extractKeywords(text) {
        if (!text) return [];

        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
            'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be',
            'this', 'that', 'it', 'as', 'from', 'how', 'what', 'when',
            'where', 'why', 'who', 'which', 'will', 'can', 'could', 'would'
        ]);

        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add discoveries and notify
     */
    addDiscoveries(newDiscoveries) {
        this.discoveries.unshift(...newDiscoveries);

        // Keep only last 100 discoveries
        if (this.discoveries.length > 100) {
            this.discoveries = this.discoveries.slice(0, 100);
        }

        // Add interests based on keywords
        if (window.brain) {
            newDiscoveries.forEach(discovery => {
                discovery.keywords.slice(0, 3).forEach(keyword => {
                    window.brain.addInterest(keyword, 0.05);
                });
            });
        }

        this.saveDiscoveries();

        if (this.onDiscovery) {
            this.onDiscovery(newDiscoveries);
        }
    }

    /**
     * Log exploration attempt
     */
    logExploration(topic, api, status, count, error = null) {
        this.explorationLog.push({
            timestamp: Date.now(),
            topic,
            api,
            status,
            resultCount: count,
            error
        });

        // Keep last 500 log entries
        if (this.explorationLog.length > 500) {
            this.explorationLog = this.explorationLog.slice(-500);
        }
    }

    /**
     * Get random topic for serendipitous discovery
     */
    getRandomTopic() {
        const topics = [
            'quantum computing', 'machine learning', 'neural networks',
            'space exploration', 'climate science', 'genetics',
            'philosophy of mind', 'cognitive science', 'robotics',
            'renewable energy', 'blockchain', 'cryptography',
            'astrophysics', 'biotechnology', 'nanotechnology',
            'consciousness', 'emergence', 'complexity theory'
        ];
        return topics[Math.floor(Math.random() * topics.length)];
    }

    /**
     * Get recent discoveries
     */
    getRecentDiscoveries(count = 10) {
        return this.discoveries.slice(0, count);
    }

    /**
     * Get discoveries by source
     */
    getDiscoveriesBySource(source) {
        return this.discoveries.filter(d => d.source === source);
    }

    /**
     * Get exploration statistics
     */
    getStats() {
        const last24h = Date.now() - (24 * 60 * 60 * 1000);
        const recentLogs = this.explorationLog.filter(l => l.timestamp > last24h);

        return {
            totalDiscoveries: this.discoveries.length,
            totalExplorations: this.explorationLog.length,
            last24hExplorations: recentLogs.length,
            successRate: recentLogs.length > 0
                ? recentLogs.filter(l => l.status === 'success').length / recentLogs.length
                : 0,
            bySource: {
                wikipedia: this.discoveries.filter(d => d.source === 'Wikipedia').length,
                hackerNews: this.discoveries.filter(d => d.source === 'Hacker News').length,
                reddit: this.discoveries.filter(d => d.source === 'Reddit').length,
                openLibrary: this.discoveries.filter(d => d.source === 'Open Library').length
            }
        };
    }

    /**
     * Save discoveries to localStorage
     */
    saveDiscoveries() {
        const data = {
            discoveries: this.discoveries,
            explorationLog: this.explorationLog.slice(-100),
            savedAt: Date.now()
        };
        localStorage.setItem('curiosity-discoveries', JSON.stringify(data));
    }

    /**
     * Load discoveries from localStorage
     */
    loadDiscoveries() {
        const saved = localStorage.getItem('curiosity-discoveries');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.discoveries = data.discoveries || [];
                this.explorationLog = data.explorationLog || [];
                console.log(`[Explorer] Loaded ${this.discoveries.length} discoveries`);
            } catch (e) {
                console.error('[Explorer] Failed to load discoveries:', e);
            }
        }
    }

    /**
     * Export discoveries for GitHub persistence
     */
    export() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            discoveries: this.discoveries,
            explorationLog: this.explorationLog,
            stats: this.getStats()
        };
    }

    /**
     * Import discoveries
     */
    import(data) {
        if (data.version !== 1) {
            throw new Error('Incompatible discoveries version');
        }

        // Merge discoveries
        const existingIds = new Set(this.discoveries.map(d => d.id));
        const newDiscoveries = data.discoveries.filter(d => !existingIds.has(d.id));

        this.discoveries = [...newDiscoveries, ...this.discoveries].slice(0, 100);
        this.explorationLog = data.explorationLog || this.explorationLog;
        this.saveDiscoveries();

        console.log(`[Explorer] Imported ${newDiscoveries.length} new discoveries`);
    }

    /**
     * Reset all discoveries
     */
    reset() {
        this.discoveries = [];
        this.explorationLog = [];
        localStorage.removeItem('curiosity-discoveries');
        console.log('[Explorer] Reset complete');
    }
}

// Export singleton instance
window.explorer = new AutonomousExplorer();
