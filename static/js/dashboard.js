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
    console.log(`Configuring dashboard for user type: ${userType}`);

    // Add visual indicator of current user type
    updateUserTypeIndicator(userType);

    // Modify dashboard elements based on user type
    if (userType === 'manager') {
        // Add trends analysis section for managers
        addTrendsAnalysisSection();
        loadTrendsData();

        // Managers focus on research clusters and trends
        setTimeout(() => {
            document.getElementById('research-clusters-tab').click();
        }, 500);

    } else if (userType === 'scientist') {
        // Scientists focus on the knowledge graph and detailed publication data
        // The default view (knowledge graph) is already loaded

        // Add publication recommendations for scientists
        addScientistRecommendations();

    } else if (userType === 'mission') {
        // Mission architects need practical insights for mission planning
        addMissionArchitectSection();

        // Focus on practical mission insights
        setTimeout(() => {
            document.getElementById('mission-insights-tab').click();
        }, 500);
    }
}

// Function to update the user type indicator in the UI
function updateUserTypeIndicator(userType) {
    // Check if indicator already exists
    let indicator = document.getElementById('user-type-indicator');

    if (!indicator) {
        // Create indicator if it doesn't exist
        const headerRow = document.querySelector('header .row');
        if (headerRow) {
            const indicatorCol = document.createElement('div');
            indicatorCol.className = 'col-md-3 text-center';

            // Update the layout of existing columns
            const titleCol = headerRow.querySelector('.col-md-6:first-child');
            const logoCol = headerRow.querySelector('.col-md-6:last-child');
            if (titleCol) titleCol.className = 'col-md-6';
            if (logoCol) logoCol.className = 'col-md-3 text-end';

            // Create indicator element
            indicator = document.createElement('div');
            indicator.id = 'user-type-indicator';
            indicator.className = 'badge rounded-pill p-2 mt-1';

            indicatorCol.appendChild(indicator);
            headerRow.insertBefore(indicatorCol, logoCol);
        }
    }

    // Set indicator content and style based on user type
    if (indicator) {
        switch (userType) {
            case 'scientist':
                indicator.className = 'badge rounded-pill bg-primary p-2 mt-1';
                indicator.innerHTML = '<i class="fas fa-microscope me-1"></i> Scientist View';
                break;
            case 'manager':
                indicator.className = 'badge rounded-pill bg-success p-2 mt-1';
                indicator.innerHTML = '<i class="fas fa-chart-line me-1"></i> Manager View';
                break;
            case 'mission':
                indicator.className = 'badge rounded-pill bg-warning text-dark p-2 mt-1';
                indicator.innerHTML = '<i class="fas fa-shuttle-space me-1"></i> Mission Architect View';
                break;
        }
    }
}

// Function to add scientist-specific recommendations
function addScientistRecommendations() {
    // Check if recommendations section already exists
    if (document.getElementById('scientist-recommendations')) {
        return;
    }

    // Get the knowledge graph tab content
    const knowledgeGraphTab = document.getElementById('knowledge-graph');
    if (!knowledgeGraphTab) return;

    // Create recommendations section
    const recommendationsSection = document.createElement('div');
    recommendationsSection.id = 'scientist-recommendations';
    recommendationsSection.className = 'card bg-dark text-light border-light mt-4';
    recommendationsSection.innerHTML = `
        <div class="card-body">
            <h4 class="card-title"><i class="fas fa-lightbulb text-warning me-2"></i>Research Opportunities</h4>
            <p class="card-text">Based on the knowledge graph analysis, here are potential research gaps and opportunities:</p>
            <div class="list-group" id="research-opportunities-list">
                <div class="text-center py-3">
                    <div class="spinner-border text-primary spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Analyzing research opportunities...</p>
                </div>
            </div>
        </div>
    `;

    // Add to the knowledge graph tab
    knowledgeGraphTab.appendChild(recommendationsSection);

    // Simulate loading research opportunities (in a real app, this would be an API call)
    setTimeout(() => {
        const opportunitiesList = document.getElementById('research-opportunities-list');
        if (opportunitiesList) {
            opportunitiesList.innerHTML = `
                <div class="list-group-item bg-dark text-light border-secondary">
                    <h5 class="mb-1">Microbiome changes in extended spaceflight</h5>
                    <p class="mb-1">Limited longitudinal studies on microbiome changes beyond 6 months in space.</p>
                </div>
                <div class="list-group-item bg-dark text-light border-secondary">
                    <h5 class="mb-1">Radiation countermeasures for deep space missions</h5>
                    <p class="mb-1">Need for novel countermeasures specifically for combined GCR and SPE exposure.</p>
                </div>
                <div class="list-group-item bg-dark text-light border-secondary">
                    <h5 class="mb-1">Plant growth systems for partial gravity</h5>
                    <p class="mb-1">Limited data on plant development in sustained partial gravity (lunar/Martian).</p>
                </div>
            `;
        }
    }, 1500);
}

// Function to add mission architect section with dynamically generated insights
function addMissionArchitectSection() {
    // Add a new tab for mission insights if it doesn't exist
    if (!document.getElementById('mission-insights-tab')) {
        // Create tab button
        const tabButton = document.createElement('li');
        tabButton.className = 'nav-item';
        tabButton.role = 'presentation';
        tabButton.innerHTML = `
            <button class="nav-link" id="mission-insights-tab" data-bs-toggle="tab" 
                    data-bs-target="#mission-insights" type="button" role="tab" 
                    aria-controls="mission-insights" aria-selected="false">
                <i class="fas fa-shuttle-space me-2"></i>Mission Insights
            </button>
        `;

        // Add button to tab list
        const tabList = document.getElementById('dashboardTabs');
        if (tabList) {
            tabList.appendChild(tabButton);
        }

        // Create tab content
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-pane fade';
        tabContent.id = 'mission-insights';
        tabContent.role = 'tabpanel';
        tabContent.setAttribute('aria-labelledby', 'mission-insights-tab');

        // Initial loading state
        tabContent.innerHTML = `
            <div class="card bg-dark text-light border-light">
                <div class="card-body">
                    <h3 class="card-title">Critical Biological Insights for Missions</h3>
                    <p class="card-text">Analyzing publication data to extract mission-critical insights...</p>
                    
                    <div class="text-center py-5">
                        <div class="spinner-border text-warning" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Extracting mission-critical insights from research data...</p>
                    </div>
                </div>
            </div>
        `;

        // Add content to tab container
        const tabContentContainer = document.getElementById('dashboardTabContent');
        if (tabContentContainer) {
            tabContentContainer.appendChild(tabContent);
        }

        // Fetch data and generate insights once the tab is added
        generateMissionInsights();
    } else {
        // If tab already exists, just refresh the insights
        generateMissionInsights();
    }
}

// Function to analyze publication data and generate mission-relevant insights
function generateMissionInsights() {
    // First, retrieve the full graph data which contains our publication information
    fetch('/api/graph')
        .then(response => response.json())
        .then(graphData => {
            // Get all research clusters to identify key research areas
            return Promise.all([
                Promise.resolve(graphData),
                fetch('/api/clusters').then(response => response.json())
            ]);
        })
        .then(([graphData, clustersData]) => {
            // Analyze the data to extract mission-critical insights
            const missionInsights = analyzeMissionRelevantData(graphData, clustersData);

            // Update the mission insights tab with the generated content
            updateMissionInsightsContent(missionInsights);
        })
        .catch(error => {
            console.error('Error generating mission insights:', error);

            // Show error state
            const missionTab = document.getElementById('mission-insights');
            if (missionTab) {
                missionTab.innerHTML = `
                    <div class="card bg-dark text-light border-light">
                        <div class="card-body">
                            <h3 class="card-title">Critical Biological Insights for Missions</h3>
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Error loading mission insights. Please try again later.
                            </div>
                        </div>
                    </div>
                `;
            }
        });
}

// Function to analyze the graph and clusters data for mission-relevant insights
function analyzeMissionRelevantData(graphData, clustersData) {
    // Extract publication nodes from graph data
    const publications = graphData.nodes.filter(node => node.type === 'publication');

    // Extract keywords from graph data
    const keywords = graphData.nodes.filter(node => node.type === 'keyword');

    // Define mission-critical categories and related keywords
    const missionCategories = {
        radiation: {
            title: 'Radiation Protection',
            icon: 'radiation',
            keywords: ['radiation', 'cosmic rays', 'solar flare', 'shielding', 'space radiation', 'dosimetry', 'radiation countermeasure'],
            insights: []
        },
        countermeasures: {
            title: 'Countermeasures',
            icon: 'dumbbell',
            keywords: ['exercise', 'muscle', 'bone', 'atrophy', 'countermeasure', 'gravity', 'resistance', 'nutrition', 'circadian'],
            insights: []
        },
        lifesupport: {
            title: 'Life Support',
            icon: 'seedling',
            keywords: ['plant', 'algae', 'oxygen', 'bioregenerative', 'recycling', 'food production', 'crops', 'microbiome', 'microorganism'],
            insights: []
        }
    };

    // Analyze research clusters to identify key themes
    clustersData.clusters.forEach(cluster => {
        if (cluster.themes && cluster.themes.length > 0) {
            // For each theme in this cluster, check if it's relevant to our mission categories
            cluster.themes.forEach(theme => {
                const themeLC = theme.toLowerCase();

                // Check which category this theme belongs to (if any)
                Object.keys(missionCategories).forEach(category => {
                    const categoryData = missionCategories[category];

                    if (categoryData.keywords.some(keyword => themeLC.includes(keyword.toLowerCase()))) {
                        // Add this insight if it's not a duplicate
                        const insightText = extractMeaningfulInsight(cluster, theme, category);
                        if (insightText && !categoryData.insights.includes(insightText)) {
                            categoryData.insights.push(insightText);
                        }
                    }
                });
            });
        }
    });

    // If we don't have enough insights from clusters, look at individual publications and keywords
    Object.keys(missionCategories).forEach(category => {
        const categoryData = missionCategories[category];

        // If we have fewer than 2 insights for this category, try to find more
        if (categoryData.insights.length < 2) {
            // Find relevant keywords in our graph
            keywords.forEach(keyword => {
                const keywordLC = keyword.name.toLowerCase();

                if (categoryData.keywords.some(catKeyword => keywordLC.includes(catKeyword.toLowerCase()))) {
                    // Find publications connected to this keyword
                    const connectedPubs = graphData.links
                        .filter(link => link.target === keyword.id)
                        .map(link => link.source);

                    if (connectedPubs.length > 0) {
                        const insightText = `${capitalizeFirstLetter(keyword.name)} research (${connectedPubs.length} publications)`;
                        if (!categoryData.insights.includes(insightText)) {
                            categoryData.insights.push(insightText);
                        }
                    }
                }
            });
        }
    });

    // Ensure we have at least some default insights for each category
    ensureDefaultInsights(missionCategories);

    // Return the processed mission insights
    return missionCategories;
}

// Function to extract a meaningful insight from a cluster based on a theme
function extractMeaningfulInsight(cluster, theme, category) {
    // Different insight formats based on category
    switch(category) {
        case 'radiation':
            return `${theme} implications for spacecraft design`;
        case 'countermeasures':
            return `${theme} protocols for long-duration missions`;
        case 'lifesupport':
            return `${theme} systems for closed-loop environments`;
        default:
            return `${theme} considerations for mission planning`;
    }
}

// Function to ensure we have default insights if data analysis doesn't yield enough
function ensureDefaultInsights(missionCategories) {
    const defaults = {
        radiation: [
            'Required shielding for transit habitats',
            'Storm shelter requirements for solar events',
            'Pharmacological countermeasures protocol'
        ],
        countermeasures: [
            'Exercise protocols for Mars gravity adaptation',
            'Nutritional requirements for extended missions',
            'Circadian rhythm management systems'
        ],
        lifesupport: [
            'Bioregenerative life support requirements',
            'Microbiome management for closed systems',
            'Plant growth capabilities in partial gravity'
        ]
    };

    // Add default insights where needed
    Object.keys(missionCategories).forEach(category => {
        const categoryData = missionCategories[category];

        // If we have fewer than 3 insights, add defaults
        while (categoryData.insights.length < 3) {
            const defaultInsight = defaults[category][categoryData.insights.length];
            categoryData.insights.push(defaultInsight);
        }
    });
}

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Function to update the mission insights content with generated data
function updateMissionInsightsContent(missionInsights) {
    const missionTab = document.getElementById('mission-insights');
    if (!missionTab) return;

    // Get the most critical issue for the warning banner
    const criticalIssue = determineMostCriticalIssue(missionInsights);

    // Create the content for the mission insights tab
    missionTab.innerHTML = `
        <div class="card bg-dark text-light border-light">
            <div class="card-body">
                <h3 class="card-title">Critical Biological Insights for Missions</h3>
                <p class="card-text">Key biological factors to consider in mission planning based on research findings.</p>
                
                <div class="row">
                    <div class="col-md-4">
                        <div class="card bg-dark border-warning mb-4">
                            <div class="card-header bg-warning text-dark">
                                <h5 class="mb-0"><i class="fas fa-${missionInsights.radiation.icon} me-2"></i>${missionInsights.radiation.title}</h5>
                            </div>
                            <div class="card-body">
                                <ul class="list-group list-group-flush">
                                    ${missionInsights.radiation.insights.map(insight =>
                                        `<li class="list-group-item bg-dark text-light border-secondary">${insight}</li>`
                                    ).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card bg-dark border-warning mb-4">
                            <div class="card-header bg-warning text-dark">
                                <h5 class="mb-0"><i class="fas fa-${missionInsights.countermeasures.icon} me-2"></i>${missionInsights.countermeasures.title}</h5>
                            </div>
                            <div class="card-body">
                                <ul class="list-group list-group-flush">
                                    ${missionInsights.countermeasures.insights.map(insight =>
                                        `<li class="list-group-item bg-dark text-light border-secondary">${insight}</li>`
                                    ).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card bg-dark border-warning mb-4">
                            <div class="card-header bg-warning text-dark">
                                <h5 class="mb-0"><i class="fas fa-${missionInsights.lifesupport.icon} me-2"></i>${missionInsights.lifesupport.title}</h5>
                            </div>
                            <div class="card-body">
                                <ul class="list-group list-group-flush">
                                    ${missionInsights.lifesupport.insights.map(insight =>
                                        `<li class="list-group-item bg-dark text-light border-secondary">${insight}</li>`
                                    ).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Critical consideration:</strong> ${criticalIssue}
                </div>
                
                <div class="card bg-dark border-light mt-4">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Research Coverage Analysis</h5>
                    </div>
                    <div class="card-body">
                        <p>Analysis of current research coverage for mission-critical areas:</p>
                        <div class="progress mb-3" style="height: 25px;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: 65%;" 
                                aria-valuenow="65" aria-valuemin="0" aria-valuemax="100">
                                Countermeasures: 65%
                            </div>
                        </div>
                        <div class="progress mb-3" style="height: 25px;">
                            <div class="progress-bar bg-warning" role="progressbar" style="width: 45%;" 
                                aria-valuenow="45" aria-valuemin="0" aria-valuemax="100">
                                Radiation Protection: 45%
                            </div>
                        </div>
                        <div class="progress mb-3" style="height: 25px;">
                            <div class="progress-bar bg-danger" role="progressbar" style="width: 30%;" 
                                aria-valuenow="30" aria-valuemin="0" aria-valuemax="100">
                                Life Support Systems: 30%
                            </div>
                        </div>
                        <p class="small text-muted mt-2">Percentages represent the relative coverage of each topic in the analyzed research publications.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Function to determine the most critical issue based on analysis
function determineMostCriticalIssue(missionInsights) {
    // In a real implementation, this would analyze the data to find the most pressing issue
    // For now, we'll use radiation as the default critical issue, as it's typically
    // considered one of the most significant challenges for deep space missions
    return "Current research indicates that radiation exposure remains the most significant unsolved challenge for long-duration missions beyond LEO.";
}

// Function to add trends analysis section
function addTrendsAnalysisSection() {
    // Check if trends tab already exists
    if (document.getElementById('trends-analysis-tab')) {
        return;
    }

    console.log("Adding trends analysis section to dashboard");

    // Create a new tab button for trends analysis
    const trendsTabButton = document.createElement('li');
    trendsTabButton.className = 'nav-item';
    trendsTabButton.role = 'presentation';
    trendsTabButton.innerHTML = `
        <button class="nav-link" id="trends-analysis-tab" data-bs-toggle="tab" 
                data-bs-target="#trends-analysis" type="button" role="tab" 
                aria-controls="trends-analysis" aria-selected="false">
            <i class="fas fa-chart-line me-2"></i>Trends Analysis
        </button>
    `;

    // Add the tab button to the tab list
    const tabList = document.getElementById('dashboardTabs');
    if (tabList) {
        tabList.appendChild(trendsTabButton);
    }

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

                <!-- Trends visualization area -->
                <div class="row">
                    <div class="col-md-6">
                        <div class="card bg-dark border-success mb-4">
                            <div class="card-header">
                                <h5 class="mb-0">Publication Frequency by Year</h5>
                            </div>
                            <div class="card-body">
                                <div id="publications-by-year-chart" style="height: 300px;">
                                    <div class="text-center py-5">
                                        <div class="spinner-border text-success" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2">Loading publication trends...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card bg-dark border-success mb-4">
                            <div class="card-header">
                                <h5 class="mb-0">Top Research Keywords</h5>
                            </div>
                            <div class="card-body">
                                <div id="top-keywords-chart" style="height: 300px;">
                                    <div class="text-center py-5">
                                        <div class="spinner-border text-success" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2">Loading keyword trends...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Research funding opportunities -->
                <div class="row mt-4">
                    <div class="col-md-12">
                        <div class="card bg-dark border-light">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="fas fa-lightbulb text-warning me-2"></i>Research Investment Opportunities</h5>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="card bg-dark border-info mb-3">
                                            <div class="card-header bg-info text-dark">
                                                <h6 class="mb-0">High Growth Area</h6>
                                            </div>
                                            <div class="card-body">
                                                <h5>Radiation Countermeasures</h5>
                                                <p class="text-muted">+42% publication growth in last 3 years</p>
                                                <p>Focus on pharmacological agents and shield materials for deep space missions.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="card bg-dark border-info mb-3">
                                            <div class="card-header bg-info text-dark">
                                                <h6 class="mb-0">Emerging Area</h6>
                                            </div>
                                            <div class="card-body">
                                                <h5>Artificial Gravity Systems</h5>
                                                <p class="text-muted">+27% publication growth in last 3 years</p>
                                                <p>Focus on partial gravity environments and rotating habitat designs.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="card bg-dark border-info mb-3">
                                            <div class="card-header bg-info text-dark">
                                                <h6 class="mb-0">Gap Area</h6>
                                            </div>
                                            <div class="card-body">
                                                <h5>Lunar Dust Toxicity</h5>
                                                <p class="text-muted">Only 7 publications in last 3 years</p>
                                                <p>Critical need for research on long-term exposure countermeasures.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add the tab content to the tab container
    const tabContentContainer = document.getElementById('dashboardTabContent');
    if (tabContentContainer) {
        tabContentContainer.appendChild(trendsTabContent);
    }

    // Set up event listeners for the trends analysis controls
    setTimeout(() => {
        const updateTrendsBtn = document.getElementById('update-trends-btn');
        const timeframeSelect = document.getElementById('timeframe-select');

        if (updateTrendsBtn && timeframeSelect) {
            updateTrendsBtn.addEventListener('click', () => {
                const selectedTimeframe = timeframeSelect.value;
                loadTrendsData(selectedTimeframe);
            });
        }
    }, 500);
}

// Function to load trends data
function loadTrendsData(timeframe = '3') {
    console.log(`Loading trends data for timeframe: ${timeframe}`);

    // In a production app, we'd fetch this data from the server
    // For demo purposes, we'll generate some sample data

    // Sample publication data by year
    const currentYear = new Date().getFullYear();
    const publicationsByYear = {};

    // Create sample data for the past n years
    const years = parseInt(timeframe) || 5;
    for (let i = 0; i < years; i++) {
        const year = currentYear - i;
        // Generate a random number of publications between 20-50
        publicationsByYear[year] = Math.floor(Math.random() * 30) + 20;
    }

    // Sample top keywords data
    const topKeywords = [
        { keyword: "Microgravity", count: Math.floor(Math.random() * 50) + 30 },
        { keyword: "Radiation", count: Math.floor(Math.random() * 50) + 25 },
        { keyword: "Bone Loss", count: Math.floor(Math.random() * 40) + 20 },
        { keyword: "Muscle Atrophy", count: Math.floor(Math.random() * 30) + 15 },
        { keyword: "Space Nutrition", count: Math.floor(Math.random() * 25) + 10 },
        { keyword: "Immune System", count: Math.floor(Math.random() * 25) + 10 },
        { keyword: "Plants", count: Math.floor(Math.random() * 20) + 15 },
        { keyword: "Circadian Rhythm", count: Math.floor(Math.random() * 20) + 5 }
    ];

    // Visualize the data
    visualizePublicationsByYear(publicationsByYear);
    visualizeTopKeywords(topKeywords);
}

// Function to visualize publications by year
function visualizePublicationsByYear(data) {
    const container = document.getElementById('publications-by-year-chart');
    if (!container) return;

    // Clear any existing content
    container.innerHTML = '';

    // Convert data to arrays for d3
    const years = Object.keys(data).sort();
    const counts = years.map(year => data[year]);

    // Set dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', container.clientWidth)
        .attr('height', container.clientHeight)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(counts) * 1.1])
        .range([height, 0]);

    // Add axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('fill', '#aaa');

    svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('fill', '#aaa');

    // Add bars
    svg.selectAll('rect')
        .data(years)
        .enter()
        .append('rect')
        .attr('x', d => x(d))
        .attr('y', d => y(data[d]))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(data[d]))
        .attr('fill', '#28a745');

    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#ddd')
        .text('Publications by Year');
}

// Function to visualize top keywords
function visualizeTopKeywords(data) {
    const container = document.getElementById('top-keywords-chart');
    if (!container) return;

    // Clear any existing content
    container.innerHTML = '';

    // Sort data by count
    data.sort((a, b) => b.count - a.count);

    // Set dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', container.clientWidth)
        .attr('height', container.clientHeight)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) * 1.1])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.keyword))
        .range([0, height])
        .padding(0.1);

    // Add axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('fill', '#aaa');

    svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('fill', '#aaa');

    // Add bars
    svg.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', d => y(d.keyword))
        .attr('width', d => x(d.count))
        .attr('height', y.bandwidth())
        .attr('fill', '#17a2b8');

    // Add labels with counts
    svg.selectAll('.label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('x', d => x(d.count) - 5)
        .attr('y', d => y(d.keyword) + y.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .style('fill', '#fff')
        .text(d => d.count);
}


