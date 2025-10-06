// main.js - JavaScript for the main index page

document.addEventListener('DOMContentLoaded', function() {
    // Load statistics for the dashboard
    loadStatistics();

    // Set up search functionality
    setupSearch();

    // Load graph preview
    initGraphPreview();
});

// Function to load statistics from API
function loadStatistics() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            // Update the statistics cards with data
            document.getElementById('total-publications').textContent = data.total_publications;
            document.getElementById('processed-publications').textContent = data.processed_publications;
            document.getElementById('graph-nodes').textContent = data.graph_nodes;
            document.getElementById('graph-edges').textContent = data.graph_edges;
        })
        .catch(error => {
            console.error('Error loading statistics:', error);
            document.getElementById('total-publications').textContent = 'Error';
            document.getElementById('processed-publications').textContent = 'Error';
            document.getElementById('graph-nodes').textContent = 'Error';
            document.getElementById('graph-edges').textContent = 'Error';
        });
}

// Function to set up search functionality
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchModal = new bootstrap.Modal(document.getElementById('search-results-modal'));
    const searchResultsContainer = document.getElementById('search-results-container');

    // Function to handle search
    const handleSearch = () => {
        const query = searchInput.value.trim();
        if (query.length === 0) return;

        // Show loading
        searchResultsContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Searching for "${query}"...</p>
            </div>
        `;
        searchModal.show();

        // Fetch search results
        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                // Display search results
                if (data.results.length === 0) {
                    searchResultsContainer.innerHTML = `
                        <div class="alert alert-info" role="alert">
                            No results found for "${query}". Try another search term.
                        </div>
                    `;
                } else {
                    let resultsHtml = `
                        <p class="mb-3">Found ${data.results.length} publications related to "${query}":</p>
                        <div class="list-group">
                    `;

                    data.results.forEach(result => {
                        resultsHtml += `
                            <a href="${result.url}" target="_blank" class="list-group-item list-group-item-action bg-dark text-light search-result-item">
                                <h5 class="mb-1">${result.title}</h5>
                                <p class="mb-1"><span class="badge bg-primary">Keyword: ${result.keyword}</span></p>
                            </a>
                        `;
                    });

                    resultsHtml += `</div>`;
                    searchResultsContainer.innerHTML = resultsHtml;
                }
            })
            .catch(error => {
                console.error('Error during search:', error);
                searchResultsContainer.innerHTML = `
                    <div class="alert alert-danger" role="alert">
                        An error occurred during search. Please try again later.
                    </div>
                `;
            });
    };

    // Event listeners for search
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
}

// Function to initialize graph preview on the home page
function initGraphPreview() {
    const graphContainer = document.getElementById('graph-container');

    console.log("Initializing graph preview...");

    // Set explicit minimum height to ensure the container has dimensions
    graphContainer.style.minHeight = '400px';

    // Show loading indicator
    graphContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading knowledge graph preview...</p>
        </div>
    `;

    // Wait briefly to ensure DOM is ready
    setTimeout(() => {
        // Fetch a subset of graph data for preview
        fetch('/api/graph')
            .then(response => response.json())
            .then(data => {
                console.log("Received graph data:", data);

                if (!data.nodes || data.nodes.length === 0) {
                    graphContainer.innerHTML = `
                        <div class="alert alert-warning m-3" role="alert">
                            No graph nodes available. The knowledge graph may not have been built correctly.
                        </div>
                    `;
                    return;
                }

                // First, separate publication nodes from keyword nodes
                const publicationNodes = data.nodes.filter(node => node.type === 'publication');

                // For a vertical layout, we want to limit the number of nodes for better visibility
                // Take a smaller set of publications for the single column layout
                const selectedPublications = publicationNodes.slice(0, 5);

                // Get the connected keywords for these publications
                const publicationIds = new Set(selectedPublications.map(pub => pub.id));
                const relatedKeywords = new Set();

                // Find keywords connected to the selected publications
                data.links.forEach(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

                    // If this link connects a selected publication to a keyword
                    if (publicationIds.has(sourceId)) {
                        relatedKeywords.add(targetId);
                    } else if (publicationIds.has(targetId)) {
                        relatedKeywords.add(sourceId);
                    }
                });

                // Filter keyword nodes to only include related ones, limit to 10 keywords
                const selectedKeywords = data.nodes
                    .filter(node => node.type === 'keyword' && relatedKeywords.has(node.id))
                    .slice(0, 10);

                // Combine the selected nodes - publications first, then keywords
                const previewNodes = [...selectedPublications, ...selectedKeywords];

                console.log(`Selected for vertical preview: ${selectedPublications.length} publications and ${selectedKeywords.length} keywords`);

                // Set node sizes for vertical layout - make publications stand out more
                previewNodes.forEach(node => {
                    // Adjust node sizes for vertical layout
                    const baseSize = node.type === 'keyword' ? 4 : 8;
                    node.size = baseSize + (node.size ? Math.min(node.size / 4, 6) : 0);
                });

                // Create a map of included node IDs for faster lookup
                const includedNodeIds = new Set(previewNodes.map(node => node.id));

                // Filter links to only include those connecting the preview nodes
                const previewLinks = data.links.filter(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    return includedNodeIds.has(sourceId) && includedNodeIds.has(targetId);
                });

                const previewData = {
                    nodes: previewNodes,
                    links: previewLinks
                };

                console.log("Preview data prepared:",
                            "Nodes:", previewData.nodes.length,
                            "Publications:", previewData.nodes.filter(n => n.type === 'publication').length,
                            "Keywords:", previewData.nodes.filter(n => n.type === 'keyword').length,
                            "Links:", previewData.links.length);

                // Clear loading indicator
                graphContainer.innerHTML = '';

                // Use actual container dimensions or set defaults if they're too small
                const containerWidth = Math.max(graphContainer.clientWidth, 400);
                const containerHeight = Math.max(graphContainer.clientHeight, 400);

                // Create a clean frame for the graph with padding to ensure all nodes are visible
                const padding = 40;
                graphContainer.style.padding = `${padding}px`;

                // Create a smaller, simplified version of the graph
                const graphInstance = createForceGraph(graphContainer, previewData, {
                    width: containerWidth - (padding * 2),
                    height: containerHeight - (padding * 2),
                    nodeRadius: 5,
                    clickable: false,
                    draggable: false
                });

                // Add a heading or label to the graph
                const graphLabel = document.createElement('div');
                graphLabel.className = 'graph-label';
                graphLabel.innerHTML = `<h5 class="text-center text-light mt-2">Knowledge Graph Preview</h5>
                                        <p class="text-center text-light small">Showing publications and related keywords</p>`;
                graphContainer.insertBefore(graphLabel, graphContainer.firstChild);

                // Ensure graph remains visible by adding a resize handler
                window.addEventListener('resize', () => {
                    const svg = graphInstance.svg;
                    if (svg && !svg.empty()) {
                        const newWidth = Math.max(graphContainer.clientWidth, 400) - (padding * 2);
                        const newHeight = Math.max(graphContainer.clientHeight, 400) - (padding * 2);

                        svg.attr('width', newWidth)
                           .attr('height', newHeight);

                        // Update center forces when container resizes
                        graphInstance.simulation
                            .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
                            .alpha(0.3)
                            .restart();
                    }
                });
            })
            .catch(error => {
                console.error('Error loading graph preview:', error);
                graphContainer.innerHTML = `
                    <div class="alert alert-danger m-3" role="alert">
                        Error loading graph preview: ${error.message}
                    </div>
                `;
            });
    }, 100); // Short delay to ensure container is ready
}
