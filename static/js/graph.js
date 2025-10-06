// graph.js - Knowledge graph visualization

// Function to create force-directed graph visualization
function createForceGraph(container, data, options = {}) {
    // Default options
    const defaults = {
        width: 800,
        height: 600,
        nodeRadius: 8,
        clickable: true,
        draggable: true
    };

    // Merge provided options with defaults
    const config = { ...defaults, ...options };

    // Create SVG container
    const svg = d3.select(container)
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height)
        .call(d3.zoom().on('zoom', function(event) {
            // Only allow zooming if specified in options
            if (config.draggable) {
                g.attr('transform', event.transform);
            }
        }));

    // Create a group for graph elements
    const g = svg.append('g');

    // Create a tooltip div
    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // Position nodes in a single column layout
    const nodeHeight = config.height / (data.nodes.length || 1);

    data.nodes.forEach((node, i) => {
        // Position nodes in a vertical column with some horizontal randomness
        node.x = config.width / 2 + (Math.random() - 0.5) * 50; // Small horizontal variation
        node.y = nodeHeight * (i + 0.5);  // Evenly distribute vertically
    });

    // Vertical layout parameters
    const linkDistance = Math.min(nodeHeight * 1.2, 100);
    const chargeStrength = -30; // Reduced repulsion for vertical alignment

    // Create a force simulation optimized for vertical layout
    const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(linkDistance))
        .force('charge', d3.forceManyBody().strength(chargeStrength))
        .force('center', d3.forceCenter(config.width / 2, config.height / 2))
        .force('collision', d3.forceCollide().radius(d => (d.size || config.nodeRadius) * 1.2))
        // Strong y-positioning to maintain vertical ordering
        .force('y', d3.forceY(d => {
            const i = data.nodes.indexOf(d);
            return nodeHeight * (i + 0.5);
        }).strength(0.2))
        // Weak x-centering force
        .force('x', d3.forceX(config.width / 2).strength(0.05))
        .velocityDecay(0.4); // Higher damping for stability

    // Create links
    const links = g.selectAll('.link')
        .data(data.links)
        .enter()
        .append('line')
        .attr('class', d => `link link-${d.section || 'default'}`)
        .attr('stroke-width', d => Math.sqrt(d.weight || 1));

    // Create nodes
    const nodes = g.selectAll('.node')
        .data(data.nodes)
        .enter()
        .append('circle')
        .attr('class', d => `node node-${d.type}`)
        .attr('r', d => d.size || config.nodeRadius)
        .call(config.draggable ? d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended) : () => {});

    // Add node labels
    const labels = g.selectAll('.label')
        .data(data.nodes)
        .enter()
        .append('text')
        .attr('class', 'node-label')
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .text(d => d.name ? (d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name) : '')
        .style('fill', '#fff')
        .style('font-size', '10px')
        .style('pointer-events', 'none')
        .style('opacity', 0);

    // Show label on hover
    nodes.on('mouseover', function(event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);

        tooltip.transition()
            .duration(200)
            .style('opacity', .9);

        tooltip.html(d.name)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
        d3.select(this).attr('stroke', null);

        tooltip.transition()
            .duration(500)
            .style('opacity', 0);
    });

    // Handle node click events
    if (config.clickable) {
        nodes.on('click', function(event, d) {
            event.preventDefault();
            event.stopPropagation();

            // Update node styling
            nodes.classed('node-selected', false);
            d3.select(this).classed('node-selected', true);

            // Fire custom event with node data
            const nodeClickEvent = new CustomEvent('node-clicked', { detail: d });
            document.dispatchEvent(nodeClickEvent);
        });
    }

    // Update positions on tick
    simulation.on('tick', () => {
        links
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        nodes
            .attr('cx', d => Math.max(config.nodeRadius, Math.min(config.width - config.nodeRadius, d.x)))
            .attr('cy', d => Math.max(config.nodeRadius, Math.min(config.height - config.nodeRadius, d.y)));

        labels
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });

    // Heat up and run the simulation several times before initial rendering
    simulation.alpha(0.8).restart();
    for (let i = 0; i < 50; i++) {
        simulation.tick();
    }

    // Drag functions
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    // Expose methods to control the graph
    return {
        svg,
        simulation,
        nodes,
        links,
        labels,
        update: function(newData) {
            // Implementation for updating data
        },
        highlightNode: function(nodeId) {
            nodes.classed('node-selected', d => d.id === nodeId);
        }
    };
}
