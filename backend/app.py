from flask import Flask, render_template, request, jsonify
import os
import sys
import json
import glob
from datetime import datetime

# Add the backend directory to the path so we can import the data processor
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.data_processor import PublicationProcessor

app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static'),
            template_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates'))

# Initialize the processor with all publications
csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'SB_publications', 'SB_publication_PMC.csv')
processor = PublicationProcessor(csv_path)

# Build knowledge graph with all publications instead of a limited number
# In a production environment, this would be a background job
MAX_INITIAL_PUBLICATIONS = None  # No limit - use all publications

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    """Render the dashboard page."""
    return render_template('dashboard.html')

@app.route('/api/stats')
def get_stats():
    """Return basic statistics about the publications."""
    total_publications = processor.get_publication_count()

    # Build the graph if not already built
    if not hasattr(processor, 'knowledge_graph') or processor.knowledge_graph.number_of_nodes() == 0:
        processor.build_knowledge_graph(num_publications=MAX_INITIAL_PUBLICATIONS)

    graph_nodes = processor.knowledge_graph.number_of_nodes()
    graph_edges = processor.knowledge_graph.number_of_edges()

    # Fix the issue with processed_publications when MAX_INITIAL_PUBLICATIONS is None
    processed_publications = total_publications if MAX_INITIAL_PUBLICATIONS is None else min(MAX_INITIAL_PUBLICATIONS, total_publications)

    return jsonify({
        'total_publications': total_publications,
        'processed_publications': processed_publications,
        'graph_nodes': graph_nodes,
        'graph_edges': graph_edges
    })

@app.route('/api/graph')
def get_graph():
    """Return the knowledge graph data for visualization."""
    # Build the graph if not already built
    if not hasattr(processor, 'knowledge_graph') or processor.knowledge_graph.number_of_nodes() == 0:
        processor.build_knowledge_graph(num_publications=MAX_INITIAL_PUBLICATIONS)

    graph_data = processor.generate_graph_data_for_visualization()
    return jsonify(graph_data)

@app.route('/api/search')
def search():
    """Search for publications by keyword or full text."""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'results': []})

    # Get optional parameters
    section = request.args.get('section', None)
    exact_match = request.args.get('exact', 'false').lower() == 'true'
    search_type = request.args.get('type', 'full').lower()  # Options: 'full', 'keyword'

    # Build the graph if not already built
    if not hasattr(processor, 'knowledge_graph') or processor.knowledge_graph.number_of_nodes() == 0:
        processor.build_knowledge_graph(num_publications=MAX_INITIAL_PUBLICATIONS)

    results = []

    # If keyword search is requested or type parameter is not specified
    if search_type == 'keyword':
        keyword_results = processor.get_publication_by_keyword(query)
        return jsonify({'results': keyword_results, 'search_type': 'keyword'})
    else:
        # Use the new full text search method
        full_text_results = processor.search_publications_full_text(
            query,
            section=section,
            exact_match=exact_match
        )
        return jsonify({
            'results': full_text_results,
            'search_type': 'full_text',
            'query': query,
            'filters': {
                'section': section,
                'exact_match': exact_match
            }
        })

@app.route('/api/similar/<path:title>')
def similar_publications(title):
    """Find publications similar to the given title."""
    # Build the graph if not already built
    if not hasattr(processor, 'knowledge_graph') or processor.knowledge_graph.number_of_nodes() == 0:
        processor.build_knowledge_graph(num_publications=MAX_INITIAL_PUBLICATIONS)

    similar = processor.get_similar_publications(title)
    return jsonify({'similar': similar})

@app.route('/api/clusters')
def get_clusters():
    """Return research clusters."""
    # Build the graph if not already built
    if not hasattr(processor, 'knowledge_graph') or processor.knowledge_graph.number_of_nodes() == 0:
        processor.build_knowledge_graph(num_publications=MAX_INITIAL_PUBLICATIONS)

    clusters = processor.identify_research_clusters()

    # Convert clusters to a format suitable for JSON
    clusters_json = []
    for item in clusters:
        if len(item) == 3:  # Using the new format with themes
            cluster_id, publications, themes = item
            clusters_json.append({
                'id': cluster_id,
                'size': len(publications),
                'publications': publications[:10],  # Limit to 10 publications per cluster
                'themes': themes  # Add the common research themes
            })
        else:  # Fallback for old format without themes
            cluster_id, publications = item
            clusters_json.append({
                'id': cluster_id,
                'size': len(publications),
                'publications': publications[:10]  # Limit to 10 publications per cluster
            })

    return jsonify({'clusters': clusters_json})

@app.route('/api/content-status')
def get_content_status():
    """Check the status of content fetching for the publications."""
    # Get the status of the first few publications
    status_list = []

    for index, row in processor.publications_df.head(10).iterrows():
        title = row['Title']
        url = row['Link']

        # Check if we have cached data for this URL
        cache_file = os.path.join(processor.cache_dir, f"{hash(url)}.json")
        status = {
            'title': title,
            'url': url,
            'cached': os.path.exists(cache_file)
        }

        if status['cached']:
            try:
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                    status['source'] = data.get('source', 'unknown')
                    status['status'] = data.get('status', 'unknown')
                    status['abstract_length'] = len(data.get('abstract', ''))
                    status['conclusion_length'] = len(data.get('conclusion', ''))
                    status['has_content'] = status['abstract_length'] > 0 or status['conclusion_length'] > 0

                    # Get the first 100 characters of the abstract as a preview
                    abstract_preview = data.get('abstract', '')[:100]
                    if abstract_preview:
                        abstract_preview += "..." if len(data.get('abstract', '')) > 100 else ""
                    status['abstract_preview'] = abstract_preview
            except Exception as e:
                status['error'] = str(e)

        status_list.append(status)

    # Get overall stats
    total_cache_files = len([f for f in os.listdir(processor.cache_dir) if f.endswith('.json') and not f == 'knowledge_graph.json'])

    # Return the status information
    return jsonify({
        'total_publications': processor.get_publication_count(),
        'cached_publications': total_cache_files,
        'sample_status': status_list
    })

@app.route('/api/publication-content/<path:url>')
def get_publication_content(url):
    """Get the content that was fetched for a specific publication URL."""
    # URL decode the parameter
    url = request.args.get('url', url)

    # Find the cache file
    cache_file = os.path.join(processor.cache_dir, f"{hash(url)}.json")

    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                data = json.load(f)

            # Check if there's a raw HTML file
            raw_html_path = os.path.join(processor.cache_dir, f"{hash(url)}_raw.html")
            has_raw_html = os.path.exists(raw_html_path)

            return jsonify({
                'url': url,
                'source': data.get('source', 'unknown'),
                'status': data.get('status', 'unknown'),
                'abstract': data.get('abstract', ''),
                'results': data.get('results', ''),
                'conclusion': data.get('conclusion', ''),
                'has_raw_html': has_raw_html,
                'error': data.get('error', None)
            })
        except Exception as e:
            return jsonify({'error': f"Error reading cache file: {str(e)}"})
    else:
        return jsonify({'error': 'No cached data found for this URL'})

@app.route('/api/publications-by-keyword/<path:keyword>')
def publications_by_keyword(keyword):
    """Return publications associated with a specific keyword."""
    # Build the graph if not already built
    if not hasattr(processor, 'knowledge_graph') or processor.knowledge_graph.number_of_nodes() == 0:
        processor.build_knowledge_graph(num_publications=MAX_INITIAL_PUBLICATIONS)

    # Get publications associated with this keyword
    publications = processor.get_publications_by_keyword(keyword)

    return jsonify({'publications': publications})

@app.route('/api/publication-trends')
def get_publication_trends():
    """Return publication trend data for analysis."""
    try:
        timeframe = int(request.args.get('timeframe', 3))  # Default to 3 years
        metric = request.args.get('metric', 'publication-count')  # Default to publication count

        # Get current date
        current_date = datetime.now()
        current_year = current_date.year

        # Calculate cutoff date based on timeframe (in years)
        cutoff_year = current_year - timeframe

        # Read all JSON files from cache directory
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'cache')
        json_files = [f for f in glob.glob(os.path.join(cache_dir, "*.json"))]

        # Process publication data
        publications_by_year = {}
        keyword_frequency = {}

        # Initialize publication years
        for year in range(cutoff_year, current_year + 1):
            publications_by_year[str(year)] = 0

        # Process each publication
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    publication = json.load(f)

                # Skip if no publication date
                if not publication.get('publishedDate'):
                    continue

                # Extract year from publication date
                pub_year = publication.get('publishedDate', '').split('-')[0] # Get year from YYYY-MM-DD
                if not pub_year.isdigit():
                    continue

                pub_year = int(pub_year)

                # Only count publications within the requested timeframe
                if pub_year >= cutoff_year and pub_year <= current_year:
                    # Increment count for this year
                    year_key = str(pub_year)
                    if year_key in publications_by_year:
                        publications_by_year[year_key] += 1
                    else:
                        publications_by_year[year_key] = 1

                    # Extract keywords from abstract
                    if publication.get('abstract'):
                        keywords = extract_keywords(publication['abstract'])
                        for keyword in keywords:
                            if keyword in keyword_frequency:
                                keyword_frequency[keyword] += 1
                            else:
                                keyword_frequency[keyword] = 1
            except Exception as e:
                print(f"Error processing file {json_file}: {e}")

        # Sort keywords by frequency and get top 10
        sorted_keywords = sorted(keyword_frequency.items(), key=lambda x: x[1], reverse=True)[:10]

        # Calculate yearly growth rates
        yearly_growth_rates = calculate_growth_rates(publications_by_year)

        return jsonify({
            'publicationsByYear': publications_by_year,
            'yearlyGrowthRates': yearly_growth_rates,
            'topKeywords': sorted_keywords,
            'timeframe': timeframe
        })

    except Exception as e:
        print(f"Error in publication trends API: {e}")
        return jsonify({'error': 'Failed to process publication trends'}), 500

def extract_keywords(text):
    """Extract keywords from text."""
    # Remove common stop words
    stop_words = ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of']

    # Split text into words, convert to lowercase, filter short words and stop words
    words = text.lower().split()
    filtered_words = [word.strip('.,;:()[]{}"\'"') for word in words
                      if len(word) > 3 and word.lower() not in stop_words]

    # Get unique words to count them properly
    unique_words = list(set(filtered_words))

    return unique_words

def calculate_growth_rates(publications_by_year):
    """Calculate growth rates year over year."""
    years = sorted(publications_by_year.keys())
    growth_rates = {}

    for i in range(1, len(years)):
        current_year = years[i]
        previous_year = years[i-1]

        current_count = publications_by_year[current_year]
        previous_count = publications_by_year[previous_year]

        if previous_count > 0:
            growth_rate = ((current_count - previous_count) / previous_count) * 100
            growth_rates[current_year] = round(growth_rate, 1)
        else:
            growth_rates[current_year] = 100 if current_count > 0 else 0

    return growth_rates

if __name__ == '__main__':
    # Pre-build the knowledge graph for faster responses
    print("Pre-building knowledge graph...")
    processor.build_knowledge_graph(num_publications=MAX_INITIAL_PUBLICATIONS)

    app.run(debug=True, port=5001)
