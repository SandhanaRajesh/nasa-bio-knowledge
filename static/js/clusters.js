// clusters.js - Research clusters visualization

// Function to create a bubble chart visualization for research clusters
function createClusterVisualization(container, clustersData) {
    // Remove any existing content
    container.innerHTML = '';

    // Set dimensions for the visualization
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create SVG container
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Create a group for the visualization
    const g = svg.append('g')
        .attr('transform', `translate(${width/2}, ${height/2})`);

    // Create a tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // Scale for bubble size based on number of publications
    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(clustersData, d => d.size)])
        .range([10, 80]);

    // Color scale for clusters
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Create the bubble chart layout
    const pack = d3.pack()
        .size([width * 0.8, height * 0.8])
        .padding(5);

    // Prepare data for pack layout
    const hierarchyData = {
        children: clustersData.map(cluster => ({
            id: cluster.id,
            size: cluster.size,
            publications: cluster.publications,
            value: cluster.size
        }))
    };

    // Generate the bubble layout
    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.value);

    const bubbleData = pack(root).descendants().filter(d => d.depth === 1);

    // Create the bubbles
    const bubbles = g.selectAll('.cluster-bubble')
        .data(bubbleData)
        .enter()
        .append('circle')
        .attr('class', 'cluster-bubble')
        .attr('r', d => d.r)
        .attr('cx', d => d.x - width/2)
        .attr('cy', d => d.y - height/2)
        .style('fill', d => colorScale(d.data.id))
        .style('fill-opacity', 0.7)
        .style('stroke', d => d3.rgb(colorScale(d.data.id)).darker())
        .style('cursor', 'pointer');

    // Add labels to bubbles
    const labels = g.selectAll('.cluster-label')
        .data(bubbleData)
        .enter()
        .append('text')
        .attr('class', 'cluster-label')
        .attr('x', d => d.x - width/2)
        .attr('y', d => d.y - height/2)
        .attr('text-anchor', 'middle')
        .text(d => {
            if (d.r > 30) {
                return `Cluster ${d.data.id}`;
            }
            return '';
        })
        .style('font-size', d => Math.min(2 * d.r / 5, 12) + 'px')
        .style('fill', 'white');

    // Add the count labels
    const countLabels = g.selectAll('.cluster-count')
        .data(bubbleData)
        .enter()
        .append('text')
        .attr('class', 'cluster-count')
        .attr('x', d => d.x - width/2)
        .attr('y', d => d.y - height/2 + 15)
        .attr('text-anchor', 'middle')
        .text(d => {
            if (d.r > 25) {
                return `${d.data.size} pubs`;
            }
            return '';
        })
        .style('font-size', d => Math.min(2 * d.r / 6, 10) + 'px')
        .style('fill', 'white')
        .style('opacity', 0.8);

    // Add hover interactions
    bubbles.on('mouseover', function(event, d) {
        // Highlight the bubble
        d3.select(this)
            .style('stroke-width', 3)
            .style('fill-opacity', 0.9);

        // Show tooltip with themes if available
        tooltip.transition()
            .duration(200)
            .style('opacity', .9);

        let tooltipContent = `
            <strong>Cluster ${d.data.id}</strong><br>
            ${d.data.size} publications
        `;

        // Add themes if available
        if (d.data.publications && d.data.themes && d.data.themes.length > 0) {
            tooltipContent += `<br><span class="text-muted">Common themes:</span><br>`;
            tooltipContent += `<small>${d.data.themes.join(", ")}</small>`;
        }

        tooltip.html(tooltipContent)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
        // Reset bubble styling
        d3.select(this)
            .style('stroke-width', 1.5)
            .style('fill-opacity', 0.7);

        // Hide tooltip
        tooltip.transition()
            .duration(500)
            .style('opacity', 0);
    })
    .on('click', function(event, d) {
        // Trigger the accordion for this cluster
        const accordionButton = document.querySelector(`#cluster-heading-${d.data.id} button`);
        if (accordionButton) {
            accordionButton.click();

            // Scroll to the accordion
            document.getElementById('clustersAccordion').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });

    // Create zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .on('zoom', function(event) {
            g.attr('transform', event.transform);
        });

    // Apply zoom behavior to the SVG
    svg.call(zoom);

    return {
        svg,
        bubbles,
        labels,
        countLabels
    };
}
