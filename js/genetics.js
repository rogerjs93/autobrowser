/**
 * GENETICS.JS - Genetic Evolution of Exploration Strategies
 * Evolves exploration behaviors over time - strategies that lead to
 * valuable discoveries survive and reproduce
 */

class GeneticEvolution {
    constructor() {
        this.population = [];        // Current population of strategies
        this.generation = 0;
        this.evolutionHistory = [];
        this.bestStrategy = null;

        this.config = {
            populationSize: 10,       // Number of strategies in population
            mutationRate: 0.15,       // Probability of gene mutation
            crossoverRate: 0.7,       // Probability of crossover
            elitismCount: 2,          // Top strategies that survive unchanged
            generationsPerCycle: 5,   // Generations before auto-evolve
            fitnessDecay: 0.95,       // Fitness decay per generation
        };

        // Event callbacks
        this.onEvolution = null;
        this.onNewGeneration = null;
        this.onStrategySelected = null;

        this.loadPopulation();

        // Initialize population if empty
        if (this.population.length === 0) {
            this.initializePopulation();
        }
    }

    /**
     * Strategy genome structure
     * Each gene controls an aspect of exploration behavior
     */
    createRandomStrategy() {
        return {
            id: this.generateId(),
            generation: this.generation,
            createdAt: Date.now(),
            fitness: 0,
            explorations: 0,
            discoveries: 0,

            // GENES - These control exploration behavior
            genes: {
                // Exploration tendency (0=focused on existing interests, 1=explore new areas)
                explorationBias: Math.random(),

                // Depth vs Breadth (0=go deep on one topic, 1=cover many topics)
                breadthPreference: Math.random(),

                // Recency bias (0=explore old interests, 1=focus on recent)
                recencyWeight: Math.random(),

                // Connection following (0=ignore connections, 1=always follow)
                connectionAffinity: Math.random(),

                // Novelty seeking (0=prefer familiar, 1=seek novel)
                noveltySeeking: Math.random(),

                // API preference weights (sum to 1 during normalization)
                apiPreferences: {
                    wikipedia: Math.random(),
                    hackerNews: Math.random(),
                    reddit: Math.random(),
                    openLibrary: Math.random()
                },

                // Time of exploration (0=morning focus, 1=evening focus)
                timePreference: Math.random(),

                // Risk taking (0=safe popular topics, 1=risky obscure topics)
                riskTolerance: Math.random(),

                // Memory influence (0=ignore past discoveries, 1=heavily influenced)
                memoryInfluence: Math.random(),

                // Serendipity factor (0=deterministic, 1=random)
                serendipityFactor: Math.random()
            }
        };
    }

    /**
     * Initialize random population
     */
    initializePopulation() {
        this.population = [];
        for (let i = 0; i < this.config.populationSize; i++) {
            this.population.push(this.createRandomStrategy());
        }
        this.savePopulation();
        console.log(`[Genetics] Initialized population with ${this.config.populationSize} strategies`);
    }

    /**
     * Select a strategy for exploration based on fitness
     * Uses tournament selection with some randomness
     */
    selectStrategy() {
        if (this.population.length === 0) {
            this.initializePopulation();
        }

        // Tournament selection: pick 3 random, choose best
        const tournamentSize = 3;
        const tournament = [];

        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * this.population.length);
            tournament.push(this.population[idx]);
        }

        // Sort by fitness (higher is better)
        tournament.sort((a, b) => b.fitness - a.fitness);

        // 70% chance best wins, 20% second, 10% third
        const rand = Math.random();
        let selected;
        if (rand < 0.7) selected = tournament[0];
        else if (rand < 0.9) selected = tournament[1] || tournament[0];
        else selected = tournament[2] || tournament[0];

        if (this.onStrategySelected) {
            this.onStrategySelected(selected);
        }

        return selected;
    }

    /**
     * Apply a strategy to exploration decisions
     * Returns exploration parameters based on strategy genes
     */
    applyStrategy(strategy) {
        const genes = strategy.genes;

        return {
            // Decide which topic to explore
            selectTopic: () => {
                if (!window.brain) return null;

                const interests = window.brain.getInterestsSorted();
                if (interests.length === 0) return null;

                // Mix of exploration vs exploitation
                if (Math.random() < genes.explorationBias) {
                    // Explore: pick less-weighted interests
                    const lowWeight = interests.filter(i => i.weight < 0.5);
                    if (lowWeight.length > 0) {
                        return lowWeight[Math.floor(Math.random() * lowWeight.length)].topic;
                    }
                }

                // Exploitation: use recency and weight
                const scored = interests.map(i => {
                    const recency = 1 - (Date.now() - i.lastActive) / (24 * 60 * 60 * 1000);
                    const score = (i.weight * (1 - genes.recencyWeight)) +
                        (Math.max(0, recency) * genes.recencyWeight);
                    return { interest: i, score };
                });

                scored.sort((a, b) => b.score - a.score);

                // Breadth preference affects how far down the list we might pick
                const maxIndex = Math.floor(scored.length * genes.breadthPreference);
                const index = Math.floor(Math.random() * Math.max(1, maxIndex));

                return scored[index]?.interest.topic || scored[0]?.interest.topic;
            },

            // Decide which API to prioritize
            selectApiOrder: () => {
                const prefs = genes.apiPreferences;
                const apis = ['wikipedia', 'hackerNews', 'reddit', 'openLibrary'];

                // Sort APIs by preference
                return apis.sort((a, b) => (prefs[b] || 0) - (prefs[a] || 0));
            },

            // Decide how many results to process
            resultLimit: () => {
                return Math.floor(3 + (genes.breadthPreference * 7)); // 3-10 results
            },

            // Should follow a connection?
            shouldFollowConnection: () => {
                return Math.random() < genes.connectionAffinity;
            },

            // Should take a risk on obscure topic?
            shouldTakeRisk: () => {
                return Math.random() < genes.riskTolerance;
            },

            // Add serendipity?
            addSerendipity: () => {
                return Math.random() < genes.serendipityFactor;
            }
        };
    }

    /**
     * Record exploration outcome and update fitness
     */
    recordOutcome(strategy, outcome) {
        strategy.explorations++;
        strategy.discoveries += outcome.discoveries || 0;

        // Calculate fitness based on outcome
        let fitnessGain = 0;

        // Reward discoveries
        fitnessGain += (outcome.discoveries || 0) * 0.3;

        // Reward new connections made
        fitnessGain += (outcome.newConnections || 0) * 0.5;

        // Reward if interests were reinforced
        fitnessGain += (outcome.reinforced || 0) * 0.1;

        // Penalty for failures
        fitnessGain -= (outcome.failures || 0) * 0.2;

        // Bonus for user engagement (if they clicked discoveries)
        fitnessGain += (outcome.userClicks || 0) * 0.4;

        // Update fitness with decay
        strategy.fitness = (strategy.fitness * this.config.fitnessDecay) + fitnessGain;
        strategy.lastUsed = Date.now();

        this.savePopulation();

        console.log(`[Genetics] Strategy ${strategy.id.slice(-4)} fitness: ${strategy.fitness.toFixed(2)}`);
    }

    /**
     * Evolve the population to create next generation
     */
    evolve() {
        if (this.population.length < 2) {
            console.warn('[Genetics] Not enough strategies to evolve');
            return;
        }

        console.log(`[Genetics] 🧬 Evolving generation ${this.generation}...`);

        // Sort by fitness
        this.population.sort((a, b) => b.fitness - a.fitness);

        const newPopulation = [];

        // Elitism: keep top strategies unchanged
        for (let i = 0; i < this.config.elitismCount; i++) {
            if (this.population[i]) {
                newPopulation.push({
                    ...JSON.parse(JSON.stringify(this.population[i])),
                    generation: this.generation + 1
                });
            }
        }

        // Fill rest with offspring
        while (newPopulation.length < this.config.populationSize) {
            // Select parents
            const parent1 = this.selectParent();
            const parent2 = this.selectParent();

            // Crossover
            let offspring;
            if (Math.random() < this.config.crossoverRate) {
                offspring = this.crossover(parent1, parent2);
            } else {
                offspring = JSON.parse(JSON.stringify(parent1));
            }

            // Mutation
            offspring = this.mutate(offspring);

            // Reset offspring stats
            offspring.id = this.generateId();
            offspring.generation = this.generation + 1;
            offspring.fitness = 0;
            offspring.explorations = 0;
            offspring.discoveries = 0;
            offspring.createdAt = Date.now();

            newPopulation.push(offspring);
        }

        // Record evolution history
        this.evolutionHistory.push({
            generation: this.generation,
            timestamp: Date.now(),
            bestFitness: this.population[0].fitness,
            averageFitness: this.population.reduce((sum, s) => sum + s.fitness, 0) / this.population.length,
            bestStrategy: this.population[0].id
        });

        // Update population
        this.population = newPopulation;
        this.generation++;
        this.bestStrategy = this.population[0];

        this.savePopulation();

        if (this.onNewGeneration) {
            this.onNewGeneration(this.generation, this.population);
        }

        console.log(`[Genetics] 🧬 Generation ${this.generation} created with ${this.population.length} strategies`);

        return {
            generation: this.generation,
            population: this.population,
            bestStrategy: this.bestStrategy
        };
    }

    /**
     * Select a parent for reproduction using fitness-proportionate selection
     */
    selectParent() {
        // Normalize fitness (ensure all positive)
        const minFitness = Math.min(...this.population.map(s => s.fitness));
        const adjusted = this.population.map(s => ({
            strategy: s,
            fitness: s.fitness - minFitness + 1
        }));

        const totalFitness = adjusted.reduce((sum, s) => sum + s.fitness, 0);
        let random = Math.random() * totalFitness;

        for (const { strategy, fitness } of adjusted) {
            random -= fitness;
            if (random <= 0) return strategy;
        }

        return this.population[0];
    }

    /**
     * Crossover two parent strategies to create offspring
     */
    crossover(parent1, parent2) {
        const offspring = this.createRandomStrategy();

        // Uniform crossover: each gene randomly from one parent
        Object.keys(offspring.genes).forEach(gene => {
            if (gene === 'apiPreferences') {
                // Handle nested object
                Object.keys(offspring.genes.apiPreferences).forEach(api => {
                    offspring.genes.apiPreferences[api] = Math.random() < 0.5
                        ? parent1.genes.apiPreferences[api]
                        : parent2.genes.apiPreferences[api];
                });
            } else {
                offspring.genes[gene] = Math.random() < 0.5
                    ? parent1.genes[gene]
                    : parent2.genes[gene];
            }
        });

        return offspring;
    }

    /**
     * Mutate a strategy's genes
     */
    mutate(strategy) {
        Object.keys(strategy.genes).forEach(gene => {
            if (Math.random() < this.config.mutationRate) {
                if (gene === 'apiPreferences') {
                    Object.keys(strategy.genes.apiPreferences).forEach(api => {
                        if (Math.random() < this.config.mutationRate) {
                            strategy.genes.apiPreferences[api] = Math.random();
                        }
                    });
                } else {
                    // Gaussian mutation: small change to existing value
                    const mutation = (Math.random() - 0.5) * 0.3;
                    strategy.genes[gene] = Math.max(0, Math.min(1, strategy.genes[gene] + mutation));
                }
            }
        });

        return strategy;
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `strat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Get evolution statistics
     */
    getStats() {
        return {
            generation: this.generation,
            populationSize: this.population.length,
            bestFitness: this.population.length > 0
                ? Math.max(...this.population.map(s => s.fitness))
                : 0,
            averageFitness: this.population.length > 0
                ? this.population.reduce((sum, s) => sum + s.fitness, 0) / this.population.length
                : 0,
            totalEvolutions: this.evolutionHistory.length,
            bestStrategy: this.bestStrategy?.id || null
        };
    }

    /**
     * Get population summary for visualization
     */
    getPopulationSummary() {
        return this.population.map(s => ({
            id: s.id,
            fitness: s.fitness,
            explorations: s.explorations,
            discoveries: s.discoveries,
            dominantTrait: this.getDominantTrait(s),
            generation: s.generation
        }));
    }

    /**
     * Identify the dominant trait of a strategy
     */
    getDominantTrait(strategy) {
        const genes = strategy.genes;
        const traits = [
            { name: 'Explorer', value: genes.explorationBias },
            { name: 'Deep Diver', value: 1 - genes.breadthPreference },
            { name: 'Connector', value: genes.connectionAffinity },
            { name: 'Novelty Seeker', value: genes.noveltySeeking },
            { name: 'Risk Taker', value: genes.riskTolerance },
            { name: 'Random Walker', value: genes.serendipityFactor }
        ];

        return traits.reduce((max, t) => t.value > max.value ? t : max).name;
    }

    /**
     * Save population to localStorage
     */
    savePopulation() {
        const data = {
            population: this.population,
            generation: this.generation,
            bestStrategy: this.bestStrategy,
            evolutionHistory: this.evolutionHistory.slice(-100),
            savedAt: Date.now()
        };
        localStorage.setItem('curiosity-genetics', JSON.stringify(data));
    }

    /**
     * Load population from localStorage
     */
    loadPopulation() {
        const saved = localStorage.getItem('curiosity-genetics');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.population = data.population || [];
                this.generation = data.generation || 0;
                this.bestStrategy = data.bestStrategy || null;
                this.evolutionHistory = data.evolutionHistory || [];
                console.log(`[Genetics] Loaded generation ${this.generation} with ${this.population.length} strategies`);
            } catch (e) {
                console.error('[Genetics] Failed to load population:', e);
            }
        }
    }

    /**
     * Export genetic data
     */
    export() {
        return {
            population: this.population,
            generation: this.generation,
            evolutionHistory: this.evolutionHistory,
            stats: this.getStats()
        };
    }

    /**
     * Reset evolution
     */
    reset() {
        this.population = [];
        this.generation = 0;
        this.evolutionHistory = [];
        this.bestStrategy = null;
        localStorage.removeItem('curiosity-genetics');
        this.initializePopulation();
    }
}

// Export singleton instance
window.genetics = new GeneticEvolution();
