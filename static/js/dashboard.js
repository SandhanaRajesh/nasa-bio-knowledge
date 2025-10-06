// dashboard.js - JavaScript for the dashboard page

document.addEventListener('DOMContentLoaded', function() {
    // Determine user type from URL parameter
    const userType = getUserTypeFromURL();

    // Initialize the dashboard with user type context
    initializeDashboard(userType);

    // Set up event listeners for dashboard tabs
    setupTabListeners();

    // Initialize the search functionality
    setupAdvancedSearch();

    // Configure dashboard for specific user type
    configureDashboardForUserType(userType);
});

// Function to get user type from URL parameter
function getUserTypeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('view') || 'scientist'; // Default to scientist view if not specified
}

// Function to initialize the dashboard
function initializeDashboard(userType) {
    // Load the knowledge graph data and create visualization with user context
    loadKnowledgeGraph(userType);

    // Set up graph control buttons
    setupGraphControls();

    // Set up node click handlers
    setupNodeClickHandlers();
}

// Function to load the knowledge graph
function loadKnowledgeGraph(userType) {
    const graphContainer = document.getElementById('full-graph-container');

    // Show loading indicator
    graphContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading knowledge graph...</p>
        </div>
    `;

    // Fetch graph data from API
    fetch('/api/graph')
        .then(response => response.json())
        .then(data => {
            // Clear loading indicator
            graphContainer.innerHTML = '';

            // Store graph data globally for filtering operations
            window.graphData = data;

            // Create the force graph
            window.graphVisualization = createForceGraph(graphContainer, data, {
                width: graphContainer.clientWidth,
                height: graphContainer.clientHeight,
                nodeRadius: 8,
                clickable: true,
                draggable: true
            });

            // Additional setup for specific user types
            if (userType === 'manager') {
                // For manager view, we might want to emphasize certain nodes or links
                emphasizeManagerView();
            } else if (userType === 'mission') {
                // For mission view, apply a different set of filters or highlights
                applyMissionFilters();
            }
        })
        .catch(error => {
            console.error('Error loading knowledge graph:', error);
            graphContainer.innerHTML = `
                <div class="alert alert-danger m-3" role="alert">
                    Error loading graph data. Please try again later.
                </div>
            `;
        });
}

// Function to emphasize certain aspects for the manager view
function emphasizeManagerView() {
    if (!window.graphVisualization) return;

    // Example: Highlight nodes with a specific attribute
    window.graphVisualization.nodes.style('stroke', d => d.isImportant ? 'gold' : null);
}

// Function to apply mission filters
function applyMissionFilters() {
    if (!window.graphVisualization) return;

    // Example: Show only nodes that are part of a specific mission
    const missionId = getCurrentMissionId();
    window.graphVisualization.nodes.style('opacity', d => d.missionId === missionId ? 1 : 0.1);
    window.graphVisualization.links.style('opacity', 0.1);
}

// Function to set up graph control buttons
function setupGraphControls() {
    const zoomInButton = document.getElementById('zoom-in-btn');
    const zoomOutButton = document.getElementById('zoom-out-btn');
    const resetButton = document.getElementById('reset-graph-btn');
    const filterToggle = document.getElementById('filter-keywords-toggle');

    // Zoom in button
    zoomInButton.addEventListener('click', () => {
        if (window.graphVisualization && window.graphVisualization.svg) {
            const zoom = d3.zoom().on('zoom', function(event) {
                window.graphVisualization.svg.select('g').attr('transform', event.transform);
            });

            window.graphVisualization.svg.transition().duration(300).call(
                zoom.scaleBy, 1.5
            );
        }
    });

    // Zoom out button
    zoomOutButton.addEventListener('click', () => {
        if (window.graphVisualization && window.graphVisualization.svg) {
            const zoom = d3.zoom().on('zoom', function(event) {
                window.graphVisualization.svg.select('g').attr('transform', event.transform);
            });

            window.graphVisualization.svg.transition().duration(300).call(
                zoom.scaleBy, 0.67
            );
        }
    });

    // Reset graph button
    resetButton.addEventListener('click', () => {
        if (window.graphVisualization && window.graphVisualization.svg) {
            const zoom = d3.zoom().on('zoom', function(event) {
                window.graphVisualization.svg.select('g').attr('transform', event.transform);
            });

            window.graphVisualization.svg.transition().duration(300).call(
                zoom.transform, d3.zoomIdentity
            );

            // Reset node positions
            window.graphVisualization.simulation.alpha(1).restart();
        }
    });

    // Filter toggle to show/hide keyword nodes
    filterToggle.addEventListener('change', () => {
        if (!window.graphVisualization) return;

        if (filterToggle.checked) {
            // Show only publication nodes
            window.graphVisualization.nodes.style('opacity', d => d.type === 'publication' ? 1 : 0.1);
            window.graphVisualization.links.style('opacity', 0.1);
        } else {
            // Show all nodes
            window.graphVisualization.nodes.style('opacity', 1);
            window.graphVisualization.links.style('opacity', 0.6);
        }
    });
}

// Function to handle node click events
function setupNodeClickHandlers() {
    const nodeDetailsPanel = document.getElementById('node-details-panel');
    const nodeDetailsTitle = document.getElementById('node-details-title');
    const nodeDetailsContent = document.getElementById('node-details-content');

    document.addEventListener('node-clicked', function(event) {
        const nodeData = event.detail;

        // Display the node details panel
        nodeDetailsPanel.style.display = 'block';

        // Set node details based on type
        if (nodeData.type === 'publication') {
            nodeDetailsTitle.innerText = 'Publication Details';

            // Show loading indicator
            nodeDetailsContent.innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-primary spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading publication details...</p>
                </div>
            `;

            // Find similar publications
            fetch(`/api/similar/${encodeURIComponent(nodeData.id)}`)
                .then(response => response.json())
                .then(data => {
                    // First try to get publication data from graph node
                    let publicationTitle = nodeData.name;
                    let publicationUrl = nodeData.url || '#';
                    let publishedDate = nodeData.publishedDate || '';

                    // Construct the display content with improved metadata
                    let contentHTML = `
                        <h5>${publicationTitle}</h5>
                    `;

                    // Add published date if available
                    if (publishedDate) {
                        // Format the date nicely
                        const formattedDate = new Date(publishedDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        contentHTML += `<p class="text-muted mb-2">Published: ${formattedDate}</p>`;
                    }

                    // Add link to original publication
                    contentHTML += `
                        <p><a href="${publicationUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-external-link-alt me-1"></i> View Original Publication
                        </a></p>
                    `;

                    // Display publication themes if available
                    if (nodeData.themes && nodeData.themes.length > 0) {
                        contentHTML += `
                            <div class="mb-3">
                                <h6 class="text-light"><i class="fas fa-tags me-2"></i>Key Themes:</h6>
                                <div class="d-flex flex-wrap gap-1 mb-2">
                        `;

                        // Create badges for each theme
                        nodeData.themes.forEach(theme => {
                            contentHTML += `
                                <span class="badge bg-info text-dark">${theme}</span>
                            `;
                        });

                        contentHTML += `
                                </div>
                            </div>
                        `;
                    }

                    contentHTML += `<hr>
                        <h6>Similar Publications:</h6>
                    `;

                    if (data.similar && data.similar.length > 0) {
                        contentHTML += '<ul class="list-group">';
                        data.similar.forEach(pub => {
                            contentHTML += `
                                <li class="list-group-item bg-dark text-light border-secondary">
                                    ${pub[0]}
                                    <span class="badge bg-primary ms-1">${pub[1]} shared topics</span>
                                </li>
                            `;
                        });
                        contentHTML += '</ul>';
                    } else {
                        contentHTML += `
                            <div class="alert alert-info">
                                No similar publications found.
                            </div>
                        `;
                    }

                    nodeDetailsContent.innerHTML = contentHTML;
                })
                .catch(error => {
                    console.error('Error loading similar publications:', error);
                    nodeDetailsContent.innerHTML = `
                        <div class="alert alert-danger">
                            Error loading publication details. Please try again later.
                        </div>
                    `;
                });
        } else if (nodeData.type === 'keyword') {
            nodeDetailsTitle.innerText = 'Keyword Details';

            // Show loading indicator
            nodeDetailsContent.innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-primary spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading keyword details...</p>
                </div>
            `;

            // Find publications with this keyword
            fetch(`/api/publications-by-keyword/${encodeURIComponent(nodeData.id)}`)
                .then(response => response.json())
                .then(data => {
                    let contentHTML = `
                        <h5>Keyword: ${nodeData.name}</h5>
                        <hr>
                        <h6>Publications with this keyword:</h6>
                    `;

                    if (data.publications && data.publications.length > 0) {
                        contentHTML += '<ul class="list-group">';
                        data.publications.forEach(pub => {
                            contentHTML += `
                                <li class="list-group-item bg-dark text-light border-secondary">
                                    <a href="${pub.url}" target="_blank" class="text-light text-decoration-none">
                                        ${pub.title}
                                    </a>
                                </li>
                            `;
                        });
                        contentHTML += '</ul>';
                    } else {
                        contentHTML += `
                            <div class="alert alert-info">
                                No publications found with this keyword.
                            </div>
                        `;
                    }

                    nodeDetailsContent.innerHTML = contentHTML;
                })
                .catch(error => {
                    console.error('Error loading keyword details:', error);
                    nodeDetailsContent.innerHTML = `
                        <div class="alert alert-danger">
                            Error loading keyword details. Please try again later.
                        </div>
                    `;
                });
        }
    });
}

// Function to set up tab listeners
function setupTabListeners() {
    const tabElements = document.querySelectorAll('button[data-bs-toggle="tab"]');

    tabElements.forEach(tab => {
        tab.addEventListener('shown.bs.tab', event => {
            const targetId = event.target.getAttribute('data-bs-target');

            // Handle tab-specific initialization
            if (targetId === '#research-clusters') {
                loadResearchClusters();
            }
        });
    });
}

// Function to load research clusters
function loadResearchClusters() {
    const clustersContainer = document.getElementById('clusters-container');
    const clustersAccordion = document.getElementById('clustersAccordion');
    const clustersLoading = document.getElementById('clusters-loading');

    // Check if clusters are already loaded
    if (clustersContainer.querySelector('svg')) return;

    // Fetch clusters data
    fetch('/api/clusters')
        .then(response => response.json())
        .then(data => {
            // Once we have the data, create the cluster visualization
            createClusterVisualization(clustersContainer, data.clusters);

            // Create accordion items for each cluster
            let accordionHTML = '';

            data.clusters.forEach((cluster, index) => {
                accordionHTML += `
                    <div class="accordion-item bg-dark border-secondary">
                        <h2 class="accordion-header" id="cluster-heading-${cluster.id}">
                            <button class="accordion-button collapsed bg-dark text-light" type="button" 
                                    data-bs-toggle="collapse" data-bs-target="#cluster-collapse-${cluster.id}" 
                                    aria-expanded="false" aria-controls="cluster-collapse-${cluster.id}">
                                Cluster ${cluster.id} - ${cluster.size} Publications
                            </button>
                        </h2>
                        <div id="cluster-collapse-${cluster.id}" class="accordion-collapse collapse" 
                             aria-labelledby="cluster-heading-${cluster.id}" data-bs-parent="#clustersAccordion">
                            <div class="accordion-body">
                                <div class="row">
                                    <!-- Left column for themes -->
                                    <div class="col-md-4">
                                        <div class="sticky-top pt-2">
                                            <h5 class="border-bottom pb-2 mb-3">Cluster Information</h5>
                                            <div class="mb-2">
                                                <strong>Publications:</strong> ${cluster.size}
                                            </div>
                                            ${cluster.themes && cluster.themes.length > 0 ? 
                                                `<div class="card bg-dark border-primary mb-3">
                                                    <div class="card-header">
                                                        <h6 class="mb-0"><i class="fas fa-lightbulb text-warning me-2"></i>Common Research Themes</h6>
                                                    </div>
                                                    <div class="card-body">
                                                        ${cluster.themes.map(theme => `<span class="badge bg-info text-dark mb-1 me-1">${theme}</span>`).join(' ')}
                                                    </div>
                                                 </div>` : 
                                                 `<div class="alert alert-secondary">No common themes identified</div>`
                                            }
                                            <div class="alert alert-info small mt-3">
                                                <i class="fas fa-info-circle me-1"></i> 
                                                These are keywords shared by multiple publications in this cluster
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Right column for publications list -->
                                    <div class="col-md-8">
                                        <h5 class="border-bottom pb-2 mb-3">Publications in this Cluster (${cluster.publications.length})</h5>
                                        <ul class="list-group">
                `;

                cluster.publications.forEach((publication, i) => {
                    accordionHTML += `
                        <li class="list-group-item bg-dark text-light border-secondary">
                            <span class="badge bg-secondary me-2">${i+1}</span>
                            ${publication}
                        </li>
                    `;
                });

                accordionHTML += `
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            // Replace loading indicator with accordion content
            clustersAccordion.innerHTML = accordionHTML;
            clustersLoading.style.display = 'none';
        })
        .catch(error => {
            console.error('Error loading research clusters:', error);
            clustersContainer.innerHTML = `
                <div class="alert alert-danger m-3" role="alert">
                    Error loading research clusters. Please try again later.
                </div>
            `;
            clustersLoading.innerHTML = `
                <div class="alert alert-danger m-3" role="alert">
                    Error loading cluster details. Please try again later.
                </div>
            `;
        });
}

// Function to set up advanced search
function setupAdvancedSearch() {
    const searchInput = document.getElementById('advanced-search-input');
    const searchButton = document.getElementById('advanced-search-button');
    const resultsContainer = document.getElementById('advanced-search-results');
    const sectionFilter = document.getElementById('filter-section');
    const exactMatchCheckbox = document.getElementById('exact-match-checkbox');

    // Function to handle search
    const handleSearch = () => {
        const query = searchInput.value.trim();
        if (query.length === 0) return;

        // Show loading
        resultsContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Searching for "${query}"...</p>
            </div>
        `;

        // Build query parameters
        const params = new URLSearchParams({
            q: query
        });

        if (sectionFilter.value !== 'all') {
            params.append('section', sectionFilter.value);
        }

        if (exactMatchCheckbox.checked) {
            params.append('exact', 'true');
        }

        // Fetch search results
        fetch(`/api/search?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                // Display search results
                if (data.results.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="alert alert-info" role="alert">
                            No results found for "${query}". Try different search terms or filters.
                        </div>
                    `;
                } else {
                    let resultsHtml = `
                        <h5 class="mb-3">Found ${data.results.length} publications related to "${query}":</h5>
                        <div class="list-group">
                    `;

                    // Check which type of search results we have
                    if (data.search_type === 'keyword') {
                        // Original keyword search results
                        data.results.forEach(result => {
                            resultsHtml += `
                                <a href="${result.url}" target="_blank" class="list-group-item list-group-item-action bg-dark text-light search-result-item">
                                    <h6 class="mb-1">${result.title}</h6>
                                    <p class="mb-1"><span class="badge bg-primary">Keyword: ${result.keyword}</span></p>
                                </a>
                            `;
                        });
                    } else {
                        // New full text search results with snippets
                        data.results.forEach(result => {
                            // Create badges for matching sections
                            const sectionBadges = result.matching_sections.map(section =>
                                `<span class="badge bg-success me-1">${section}</span>`
                            ).join('');

                            // Format snippets to show context
                            let snippetsHtml = '';
                            if (result.snippets && result.snippets.length > 0) {
                                snippetsHtml = '<div class="snippets mt-2">';
                                result.snippets.forEach(snippet => {
                                    snippetsHtml += `
                                        <div class="snippet mb-2">
                                            <small class="text-muted">From ${snippet.section}:</small>
                                            <p class="snippet-text text-light-emphasis fst-italic">${snippet.text}</p>
                                        </div>
                                    `;
                                });
                                snippetsHtml += '</div>';
                            }

                            resultsHtml += `
                                <div class="list-group-item bg-dark text-light search-result-item">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <h6 class="mb-1">${result.title}</h6>
                                        <div>
                                            <a href="${result.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                                <i class="fas fa-external-link-alt"></i> View
                                            </a>
                                        </div>
                                    </div>
                                    <div class="mt-1 mb-2">
                                        ${sectionBadges}
                                    </div>
                                    ${snippetsHtml}
                                </div>
                            `;
                        });
                    }

                    resultsHtml += `</div>`;
                    resultsContainer.innerHTML = resultsHtml;
                }
            })
            .catch(error => {
                console.error('Error during search:', error);
                resultsContainer.innerHTML = `
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

// Function to configure dashboard for specific user types
function configureDashboardForUserType(userType) {
    // Modify dashboard elements based on user type
    if (userType === 'manager') {
        // Add trends analysis section for managers
        addTrendsAnalysisSection();
        loadTrendsData();
    } else if (userType === 'scientist') {
        // Special configuration for scientists if needed
    } else if (userType === 'mission') {
        // Special configuration for mission architects if needed
    }
}

// Function to add trends analysis section
function addTrendsAnalysisSection() {
    // Find main content area
    const mainContent = document.querySelector('.tab-content');
    if (!mainContent) return;

    // Create a new tab for trends analysis
    const trendsTabButton = document.createElement('li');
    trendsTabButton.className = 'nav-item';
    trendsTabButton.role = 'presentation';
    trendsTabButton.innerHTML = `
        <button class="nav-link" id="trends-analysis-tab" data-bs-toggle="tab" 
                data-bs-target="#trends-analysis" type="button" role="tab" 
                aria-controls="trends-analysis" aria-selected="false">
            <i class="fas fa-chart-line me-2"></i>Analyze Trends
        </button>
    `;

    // Create the tab content
    const trendsTabContent = document.createElement('div');
    trendsTabContent.className = 'tab-pane fade';
    trendsTabContent.id = 'trends-analysis';
    trendsTabContent.role = 'tabpanel';
    trendsTabContent.setAttribute('aria-labelledby', 'trends-analysis-tab');

    trendsTabContent.innerHTML = `
        <div class="card bg-dark text-light border-light">
            <div class="card-body">
                <h3 class="card-title">Research Trends Analysis</h3>
                <p class="card-text">Analyze trends and investment opportunities in space biology research.</p>

                <!-- Controls for trends analysis -->
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="timeframe-select">Timeframe</label>
                            <select class="form-select" id="timeframe-select">
                                <option value="3">Last 3 Years</option>
                                <option value="5">Last 5 Years</option>
                                <option value="10">Last 10 Years</option>
                                <option value="0">All Time</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6 d-flex align-items-end">
                        <button id="update-trends-btn" class="btn btn-primary">
                            <i class="fas fa-sync me-2"></i>Update Analysis
                        </button>
                    </div>
                </div>

                <!-- Charts and insights section -->
                <div class="row mb-4">
                    <div class="col-lg-6 mb-4">
                        <div class="card bg-dark border-secondary h-100">
                            <div class="card-header bg-dark">
                                <h5 class="card-title mb-0">Publication Growth Trend</h5>
                            </div>
                            <div class="card-body">
                                <div id="publication-trend-chart" class="chart-container">
                                    <div class="loading-spinner">
                                        <div class="spinner-border text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2">Loading trend data...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6 mb-4">
                        <div class="card bg-dark border-secondary h-100">
                            <div class="card-header bg-dark">
                                <h5 class="card-title mb-0">Top Research Areas</h5>
                            </div>
                            <div class="card-body">
                                <div id="top-keywords-chart" class="chart-container">
                                    <div class="loading-spinner">
                                        <div class="spinner-border text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2">Loading keyword data...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Investment insights section -->
                <div class="card bg-dark border-primary mb-4">
                    <div class="card-header bg-primary bg-opacity-25">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-lightbulb text-warning me-2"></i>Investment Insights
                        </h5>
                    </div>
                    <div class="card-body" id="investment-insights">
                        <div class="loading-spinner">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="mt-2">Analyzing investment opportunities...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add new tab button to tab list
    const tabList = document.querySelector('#dashboardTabs');
    if (tabList) {
        tabList.appendChild(trendsTabButton);
    }

    // Add tab content to tab container
    mainContent.appendChild(trendsTabContent);

    // Set up event listener for the update button
    const updateButton = document.getElementById('update-trends-btn');
    if (updateButton) {
        updateButton.addEventListener('click', loadTrendsData);
    }

    // Set up event listener for timeframe selection
    const timeframeSelect = document.getElementById('timeframe-select');
    if (timeframeSelect) {
        timeframeSelect.addEventListener('change', () => {
            // Clear current charts
            const pubChartContainer = document.getElementById('publication-trend-chart');
            const keywordsChartContainer = document.getElementById('top-keywords-chart');
            if (pubChartContainer) {
                pubChartContainer.innerHTML = `
                    <div class="loading-spinner">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading trend data...</p>
                    </div>
                `;
            }
            if (keywordsChartContainer) {
                keywordsChartContainer.innerHTML = `
                    <div class="loading-spinner">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading keyword data...</p>
                    </div>
                `;
            }

            // Load new data
            loadTrendsData();
        });
    }
}

// Function to load trends data
function loadTrendsData() {
    const timeframeSelect = document.getElementById('timeframe-select');
    const timeframe = timeframeSelect ? timeframeSelect.value : '3';

    // Fetch trends data from API
    fetch(`/api/publication-trends?timeframe=${timeframe}`)
        .then(response => response.json())
        .then(data => {
            // Create publication trend chart
            createPublicationTrendChart(data);

            // Create top keywords chart
            createTopKeywordsChart(data);

            // Generate investment insights
            generateInvestmentInsights(data);
        })
        .catch(error => {
            console.error('Error loading trends data:', error);
            const pubChartContainer = document.getElementById('publication-trend-chart');
            const keywordsChartContainer = document.getElementById('top-keywords-chart');
            const insightsContainer = document.getElementById('investment-insights');

            const errorMessage = `
                <div class="alert alert-danger" role="alert">
                    Error loading trends data. Please try again later.
                </div>
            `;

            if (pubChartContainer) pubChartContainer.innerHTML = errorMessage;
            if (keywordsChartContainer) keywordsChartContainer.innerHTML = errorMessage;
            if (insightsContainer) insightsContainer.innerHTML = errorMessage;
        });
}

// Function to create the publication trend chart
function createPublicationTrendChart(data) {
    const container = document.getElementById('publication-trend-chart');
    if (!container) return;

    // Clear loading spinner
    container.innerHTML = '';

    // Extract years and publication counts
    const years = Object.keys(data.publicationsByYear).sort();
    const counts = years.map(year => data.publicationsByYear[year]);

    // Create SVG container
    const width = container.clientWidth;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand()
        .domain(years)
        .range([0, width - margin.left - margin.right])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(counts) * 1.1]) // Add 10% padding
        .range([height - margin.top - margin.bottom, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
        .call(xAxis)
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');

    svg.append('g')
        .call(yAxis);

    // Create bars
    svg.selectAll('rect')
        .data(years)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d))
        .attr('y', d => yScale(data.publicationsByYear[d]))
        .attr('width', xScale.bandwidth())
        .attr('height', d => height - margin.top - margin.bottom - yScale(data.publicationsByYear[d]))
        .attr('fill', '#4e79a7');

    // Add labels for growth rates
    svg.selectAll('.growth-label')
        .data(years.slice(1)) // Skip first year as it has no growth rate
        .enter()
        .append('text')
        .attr('class', 'growth-label')
        .attr('x', d => xScale(d) + xScale.bandwidth() / 2)
        .attr('y', d => {
            const rate = parseFloat(data.yearlyGrowthRates[d]);
            return rate >= 0
                ? yScale(data.publicationsByYear[d]) - 5
                : yScale(data.publicationsByYear[d]) + 15;
        })
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', d => {
            const rate = parseFloat(data.yearlyGrowthRates[d]);
            return rate >= 0 ? '#4CAF50' : '#F44336';
        })
        .text(d => {
            const rate = parseFloat(data.yearlyGrowthRates[d]);
            return rate > 0 ? `+${rate}%` : `${rate}%`;
        });

    // Add title
    svg.append('text')
        .attr('x', (width - margin.left - margin.right) / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', 'white')
        .text('Publications Per Year');
}

// Function to create the top keywords chart
function createTopKeywordsChart(data) {
    const container = document.getElementById('top-keywords-chart');
    if (!container) return;

    // Clear loading spinner
    container.innerHTML = '';

    // Extract top keywords data
    const keywords = data.topKeywords.map(k => k[0]);
    const counts = data.topKeywords.map(k => k[1]);

    // Create SVG container
    const width = container.clientWidth;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 80, left: 50 };

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand()
        .domain(keywords)
        .range([0, width - margin.left - margin.right])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(counts) * 1.1]) // Add 10% padding
        .range([height - margin.top - margin.bottom, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
        .call(xAxis)
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');

    svg.append('g')
        .call(yAxis);

    // Create bars with different colors
    const colorScale = d3.scaleOrdinal()
        .domain(keywords)
        .range(['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
                '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab']);

    svg.selectAll('rect')
        .data(keywords)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d))
        .attr('y', d => yScale(data.topKeywords.find(k => k[0] === d)[1]))
        .attr('width', xScale.bandwidth())
        .attr('height', d => height - margin.top - margin.bottom - yScale(data.topKeywords.find(k => k[0] === d)[1]))
        .attr('fill', d => colorScale(d));

    // Add count labels
    svg.selectAll('.count-label')
        .data(keywords)
        .enter()
        .append('text')
        .attr('class', 'count-label')
        .attr('x', d => xScale(d) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(data.topKeywords.find(k => k[0] === d)[1]) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', 'white')
        .text(d => data.topKeywords.find(k => k[0] === d)[1]);

    // Add title
    svg.append('text')
        .attr('x', (width - margin.left - margin.right) / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', 'white')
        .text('Top Research Areas by Publication Count');
}

// Function to generate investment insights
function generateInvestmentInsights(data) {
    const container = document.getElementById('investment-insights');
    if (!container) return;

    // Extract growth trends
    const years = Object.keys(data.yearlyGrowthRates).sort();
    const recentYears = years.slice(-3); // Get last 3 years

    // Calculate average growth for recent years
    let totalGrowth = 0;
    recentYears.forEach(year => {
        totalGrowth += parseFloat(data.yearlyGrowthRates[year]) || 0;
    });
    const avgGrowth = totalGrowth / recentYears.length;

    // Determine growth trend
    let growthTrend = 'stable';
    if (avgGrowth > 15) {
        growthTrend = 'rapidly growing';
    } else if (avgGrowth > 5) {
        growthTrend = 'growing';
    } else if (avgGrowth < -5) {
        growthTrend = 'declining';
    }

    // Generate insights text
    let insightsHTML = `
        <p class="lead">Research publication activity is <strong>${growthTrend}</strong> 
        with an average growth rate of <span class="${avgGrowth >= 0 ? 'text-success' : 'text-danger'}">
        ${avgGrowth.toFixed(1)}%</span> over the past ${recentYears.length} years.</p>
    `;

    // Add top research areas analysis
    if (data.topKeywords && data.topKeywords.length > 0) {
        const topAreas = data.topKeywords.slice(0, 3).map(k => k[0]);

        insightsHTML += `
            <h6 class="mt-3">Investment Opportunity Areas:</h6>
            <p>Based on publication activity, the following research areas show the highest potential for investment:</p>
            <ol class="list-group list-group-numbered mb-3">
        `;

        topAreas.forEach(area => {
            insightsHTML += `
                <li class="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-start">
                    <div class="ms-2 me-auto">
                        <div class="fw-bold">${area.charAt(0).toUpperCase() + area.slice(1)}</div>
                        Research field with ${data.topKeywords.find(k => k[0] === area)[1]} publications
                    </div>
                    <span class="badge bg-primary rounded-pill">High Interest</span>
                </li>
            `;
        });

        insightsHTML += `</ol>`;
    }

    // Add strategy recommendation
    insightsHTML += `
        <div class="alert alert-info mt-3">
            <h6 class="alert-heading"><i class="fas fa-lightbulb me-2"></i>Strategic Recommendation:</h6>
            <p class="mb-0">Consider focusing resources on the top research areas identified above, 
            as they represent the most active fields in current space biology research.</p>
        </div>
    `;

    // Update the container
    container.innerHTML = insightsHTML;
}
