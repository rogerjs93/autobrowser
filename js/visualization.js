/**
 * VISUALIZATION.JS - Neural Network & Constellation Visualization
 * Renders interests as interactive nodes with connections
 */

class BrainVisualization {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('[Viz] Canvas not found:', canvasId);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.viewMode = 'network'; // 'network' or 'constellation'

        // Animation
        this.animationId = null;
        this.lastTime = 0;

        // Interaction
        this.hoveredNode = null;
        this.selectedNode = null;
        this.isDragging = false;
        this.dragNode = null;
        this.mouse = { x: 0, y: 0 };

        // Physics simulation
        this.physics = {
            repulsion: 5000,
            attraction: 0.01,
            damping: 0.9,
            gravity: 0.01
        };

        // Colors
        this.colors = {
            shortTerm: '#00d4ff',
            longTerm: '#a855f7',
            core: '#10b981',
            edge: 'rgba(255, 255, 255, 0.1)',
            edgeActive: 'rgba(0, 212, 255, 0.3)',
            background: 'transparent'
        };

        this.setupCanvas();
        this.setupEventListeners();
    }

    /**
     * Setup canvas dimensions
     */
    setupCanvas() {
        const resize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            this.canvas.width = rect.width * dpr;
            this.canvas.height = (rect.height - 100) * dpr;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = (rect.height - 100) + 'px';

            this.ctx.scale(dpr, dpr);
            this.width = rect.width;
            this.height = rect.height - 100;
        };

        resize();
        window.addEventListener('resize', resize);
    }

    /**
     * Setup mouse event listeners
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;

            if (this.isDragging && this.dragNode) {
                this.dragNode.x = this.mouse.x;
                this.dragNode.y = this.mouse.y;
                this.dragNode.vx = 0;
                this.dragNode.vy = 0;
            }

            this.checkHover();
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.hoveredNode) {
                this.isDragging = true;
                this.dragNode = this.hoveredNode;
                this.selectedNode = this.hoveredNode;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.dragNode = null;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredNode = null;
            this.hideTooltip();
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.hoveredNode && window.brain) {
                window.brain.addInterest(this.hoveredNode.topic, 0.1);
            }
        });
    }

    /**
     * Check if mouse is hovering over a node
     */
    checkHover() {
        let found = null;

        for (const node of this.nodes) {
            const dx = this.mouse.x - node.x;
            const dy = this.mouse.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < node.radius + 5) {
                found = node;
                break;
            }
        }

        if (found !== this.hoveredNode) {
            this.hoveredNode = found;
            if (found) {
                this.showTooltip(found);
            } else {
                this.hideTooltip();
            }
        }
    }

    /**
     * Show tooltip for node
     */
    showTooltip(node) {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip) return;

        tooltip.innerHTML = `
            <div class="tooltip-topic">${node.topic}</div>
            <div class="tooltip-stats">
                Weight: ${(node.weight * 100).toFixed(0)}%<br>
                Type: ${node.memoryType}<br>
                Connections: ${node.connections.length}
            </div>
        `;

        tooltip.style.left = (node.x + 20) + 'px';
        tooltip.style.top = (node.y - 10) + 'px';
        tooltip.classList.remove('hidden');
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.classList.add('hidden');
        }
    }

    /**
     * Update nodes from brain state
     */
    updateFromBrain() {
        if (!window.brain) return;

        const interests = window.brain.getInterestsSorted();
        const existingNodes = new Map(this.nodes.map(n => [n.topic, n]));

        // Update or create nodes
        this.nodes = interests.map(interest => {
            const existing = existingNodes.get(interest.topic);

            if (existing) {
                // Update existing node
                existing.weight = interest.weight;
                existing.memoryType = interest.memoryType;
                existing.isCore = interest.isCore;
                existing.connections = interest.connections;
                existing.targetRadius = this.calculateRadius(interest);
                return existing;
            } else {
                // Create new node
                return {
                    topic: interest.topic,
                    x: this.width / 2 + (Math.random() - 0.5) * 200,
                    y: this.height / 2 + (Math.random() - 0.5) * 200,
                    vx: 0,
                    vy: 0,
                    radius: 5,
                    targetRadius: this.calculateRadius(interest),
                    weight: interest.weight,
                    memoryType: interest.memoryType,
                    isCore: interest.isCore,
                    connections: interest.connections,
                    pulsePhase: Math.random() * Math.PI * 2
                };
            }
        });

        // Build edges
        this.edges = [];
        this.nodes.forEach(node => {
            node.connections.forEach(connectedTopic => {
                const target = this.nodes.find(n => n.topic === connectedTopic);
                if (target && node.topic < connectedTopic) { // Avoid duplicates
                    this.edges.push({
                        source: node,
                        target: target,
                        strength: 0.5
                    });
                }
            });
        });
    }

    /**
     * Calculate node radius based on weight
     */
    calculateRadius(interest) {
        const minRadius = 8;
        const maxRadius = 30;
        return minRadius + (interest.weight * (maxRadius - minRadius));
    }

    /**
     * Get color for memory type
     */
    getNodeColor(node) {
        if (node.isCore) return this.colors.core;
        if (node.memoryType === 'long-term') return this.colors.longTerm;
        return this.colors.shortTerm;
    }

    /**
     * Apply physics simulation
     */
    applyPhysics(deltaTime) {
        const dt = Math.min(deltaTime / 16, 2); // Cap delta time

        // Node repulsion
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const nodeA = this.nodes[i];
                const nodeB = this.nodes[j];

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const force = this.physics.repulsion / (dist * dist);
                const fx = (dx / dist) * force * dt;
                const fy = (dy / dist) * force * dt;

                nodeA.vx -= fx;
                nodeA.vy -= fy;
                nodeB.vx += fx;
                nodeB.vy += fy;
            }
        }

        // Edge attraction
        this.edges.forEach(edge => {
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            const force = dist * this.physics.attraction * dt;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            edge.source.vx += fx;
            edge.source.vy += fy;
            edge.target.vx -= fx;
            edge.target.vy -= fy;
        });

        // Center gravity
        this.nodes.forEach(node => {
            const dx = this.width / 2 - node.x;
            const dy = this.height / 2 - node.y;

            node.vx += dx * this.physics.gravity * dt;
            node.vy += dy * this.physics.gravity * dt;
        });

        // Apply velocity and damping
        this.nodes.forEach(node => {
            if (node === this.dragNode) return;

            node.vx *= this.physics.damping;
            node.vy *= this.physics.damping;

            node.x += node.vx * dt;
            node.y += node.vy * dt;

            // Bounds
            const margin = 50;
            node.x = Math.max(margin, Math.min(this.width - margin, node.x));
            node.y = Math.max(margin, Math.min(this.height - margin, node.y));

            // Animate radius
            node.radius += (node.targetRadius - node.radius) * 0.1;
        });
    }

    /**
     * Render network view
     */
    renderNetwork() {
        const ctx = this.ctx;

        // Clear
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw edges
        this.edges.forEach(edge => {
            const isActive =
                edge.source === this.hoveredNode ||
                edge.target === this.hoveredNode;

            ctx.beginPath();
            ctx.moveTo(edge.source.x, edge.source.y);
            ctx.lineTo(edge.target.x, edge.target.y);
            ctx.strokeStyle = isActive ? this.colors.edgeActive : this.colors.edge;
            ctx.lineWidth = isActive ? 2 : 1;
            ctx.stroke();
        });

        // Draw nodes
        this.nodes.forEach(node => {
            const isHovered = node === this.hoveredNode;
            const isSelected = node === this.selectedNode;
            const color = this.getNodeColor(node);

            // Glow effect
            if (isHovered || isSelected) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius + 15, 0, Math.PI * 2);
                const gradient = ctx.createRadialGradient(
                    node.x, node.y, node.radius,
                    node.x, node.y, node.radius + 15
                );
                gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.fill();
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

            // Gradient fill
            const gradient = ctx.createRadialGradient(
                node.x - node.radius * 0.3, node.y - node.radius * 0.3, 0,
                node.x, node.y, node.radius
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, this.darkenColor(color, 30));
            ctx.fillStyle = gradient;
            ctx.fill();

            // Border
            ctx.strokeStyle = isHovered ? '#fff' : color;
            ctx.lineWidth = isHovered ? 2 : 1;
            ctx.stroke();

            // Label for larger nodes
            if (node.radius > 15) {
                ctx.fillStyle = '#fff';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Truncate long topics
                const maxLength = Math.floor(node.radius / 3);
                const label = node.topic.length > maxLength
                    ? node.topic.substring(0, maxLength) + '...'
                    : node.topic;

                ctx.fillText(label, node.x, node.y);
            }
        });
    }

    /**
     * Render constellation view
     */
    renderConstellation() {
        const ctx = this.ctx;

        // Clear with subtle gradient
        ctx.clearRect(0, 0, this.width, this.height);

        const time = Date.now() / 1000;

        // Draw connections as subtle lines
        this.edges.forEach(edge => {
            ctx.beginPath();
            ctx.moveTo(edge.source.x, edge.source.y);
            ctx.lineTo(edge.target.x, edge.target.y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw nodes as stars
        this.nodes.forEach(node => {
            const isHovered = node === this.hoveredNode;
            const color = this.getNodeColor(node);

            // Twinkle effect
            const twinkle = 0.7 + 0.3 * Math.sin(time * 2 + node.pulsePhase);
            const radius = node.radius * 0.5 * twinkle;

            // Star glow
            const glowRadius = radius * 4;
            const gradient = ctx.createRadialGradient(
                node.x, node.y, 0,
                node.x, node.y, glowRadius
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.1, color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Star core
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            // Star rays for core interests
            if (node.isCore) {
                this.drawStarRays(node.x, node.y, radius * 3, 4, color);
            }

            // Label on hover
            if (isHovered) {
                ctx.fillStyle = '#fff';
                ctx.font = '12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(node.topic, node.x, node.y - radius - 10);
            }
        });
    }

    /**
     * Draw star rays
     */
    drawStarRays(x, y, length, count, color) {
        const ctx = this.ctx;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const endX = x + Math.cos(angle) * length;
            const endY = y + Math.sin(angle) * length;

            const gradient = ctx.createLinearGradient(x, y, endX, endY);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    /**
     * Darken a color
     */
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return `rgb(${R}, ${G}, ${B})`;
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
    }

    /**
     * Main render loop
     */
    render(time) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        this.applyPhysics(deltaTime);

        if (this.viewMode === 'constellation') {
            this.renderConstellation();
        } else {
            this.renderNetwork();
        }

        this.animationId = requestAnimationFrame((t) => this.render(t));
    }

    /**
     * Start visualization
     */
    start() {
        this.updateFromBrain();
        this.render(0);

        // Update from brain periodically
        setInterval(() => this.updateFromBrain(), 1000);
    }

    /**
     * Stop visualization
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Export
window.BrainVisualization = BrainVisualization;
