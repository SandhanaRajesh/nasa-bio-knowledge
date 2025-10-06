import pandas as pd
import nltk
import re
import os
import ssl
from collections import Counter
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import requests
from bs4 import BeautifulSoup
import networkx as nx
import json
import time
from nltk.stem import PorterStemmer

# Fix SSL certificate issues for NLTK downloads
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# Download necessary NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
except Exception as e:
    print(f"Warning: NLTK download failed: {e}")
    print("Will use simple tokenization and basic stopwords instead.")

class PublicationProcessor:
    def __init__(self, csv_path):
        """Initialize the processor with path to publications CSV."""
        self.publications_df = pd.read_csv(csv_path)

        # Create a basic set of stop words if NLTK fails
        try:
            self.stop_words = set(stopwords.words('english'))
        except LookupError:
            print("Using basic stopwords instead of NLTK's.")
            self.stop_words = {'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what',
                               'which', 'this', 'that', 'these', 'those', 'then', 'just', 'so', 'than', 'such',
                               'when', 'who', 'how', 'where', 'why', 'is', 'are', 'was', 'were', 'be', 'been',
                               'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'to', 'at',
                               'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during',
                               'before', 'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out', 'on', 'off',
                               'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'all', 'any',
                               'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
                               'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
                               'now', 'of', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
                               'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she',
                               'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
                               'themselves'}

        self.knowledge_graph = nx.Graph()
        self.cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'cache')
        os.makedirs(self.cache_dir, exist_ok=True)

    def get_publication_count(self):
        """Return the total number of publications."""
        return len(self.publications_df)

    def fetch_publication_content(self, url, cache=True):
        """Fetch the content of a publication from PubMed Central."""
        # Generate cache filename based on URL
        cache_file = os.path.join(self.cache_dir, f"{hash(url)}.json")

        # Check if we have cached data
        if cache and os.path.exists(cache_file):
            with open(cache_file, 'r') as f:
                data = json.load(f)
                print(f"Using cached data for {url} (source: {data.get('source', 'unknown')})")
                return data

        # If no cached data, fetch from URL
        try:
            # Fix URL if needed - PMC links need special handling
            # Convert from https://www.ncbi.nlm.nih.gov/pmc/articles/PMCXXXXXXX/ to https://pmc.ncbi.nlm.nih.gov/articles/PMCXXXXXXX/
            if 'www.ncbi.nlm.nih.gov/pmc/articles/' in url:
                pmc_id = url.split('/')[-1]
                if pmc_id:
                    url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmc_id}/"

            # Add delay to avoid overwhelming the server
            time.sleep(1)

            # Set headers to better mimic a browser
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Not A;Brand";v="99", "Chromium";v="115"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Referer': 'https://www.google.com/'
            }

            print(f"Attempting to fetch: {url}")
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            print(f"Successfully fetched content from {url} (Status code: {response.status_code})")

            # Save the raw HTML for debugging if needed
            debug_html_path = os.path.join(self.cache_dir, f"{hash(url)}_raw.html")
            with open(debug_html_path, 'w', encoding='utf-8') as f:
                f.write(response.text)
            print(f"Saved raw HTML to {debug_html_path}")

            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract different sections
            abstract = soup.find('div', class_='abstract')
            if not abstract:
                abstract = soup.find('div', id='abstract')
            if not abstract:
                abstract = soup.find('section', class_='abstract')
            abstract_text = abstract.get_text() if abstract else ""

            # Extract results section
            results_section = soup.find(['div', 'section'], id=lambda x: x and 'result' in x.lower())
            if not results_section:
                results_section = soup.find(['div', 'section'], class_=lambda x: x and 'result' in x.lower())
            if not results_section:
                # Try finding a heading that contains 'Results'
                results_heading = soup.find(['h1', 'h2', 'h3', 'h4'], text=lambda t: t and 'result' in t.lower())
                if results_heading:
                    results_section = results_heading.find_next(['div', 'section', 'p'])
            results_text = results_section.get_text() if results_section else ""

            # Extract conclusion section
            conclusion_section = soup.find(['div', 'section'], id=lambda x: x and 'conclusion' in x.lower())
            if not conclusion_section:
                conclusion_section = soup.find(['div', 'section'], class_=lambda x: x and 'conclusion' in x.lower())
            if not conclusion_section:
                # Try finding a heading that contains 'Conclusion'
                conclusion_heading = soup.find(['h1', 'h2', 'h3', 'h4'], text=lambda t: t and 'conclusion' in t.lower())
                if conclusion_heading:
                    conclusion_section = conclusion_heading.find_next(['div', 'section', 'p'])
            conclusion_text = conclusion_section.get_text() if conclusion_section else ""

            # Get all text from the main article content
            article_content = soup.find('article') or soup.find('div', class_='article-body') or soup.find('div', id='body')
            full_text = article_content.get_text() if article_content else soup.get_text()

            # Print summary of extracted content
            print(f"Content extracted from {url}:")
            print(f"  Abstract length: {len(abstract_text)} chars")
            print(f"  Results length: {len(results_text)} chars")
            print(f"  Conclusion length: {len(conclusion_text)} chars")
            print(f"  Full text length: {len(full_text)} chars")

            # Structure the data
            publication_data = {
                'abstract': abstract_text,
                'results': results_text,
                'conclusion': conclusion_text,
                'full_text': full_text,
                'source': 'web',
                'status': 'success',
                'timestamp': time.time()
            }

            # Cache the data
            if cache:
                with open(cache_file, 'w') as f:
                    json.dump(publication_data, f)

            return publication_data

        except Exception as e:
            print(f"Error fetching {url}: {e}")
            # Generate synthetic data from the title
            title = self.get_title_from_url(url)
            if title:
                publication_data = self.generate_synthetic_data(title)
                publication_data['error'] = str(e)
                publication_data['status'] = 'error'
                publication_data['timestamp'] = time.time()

                # Cache the synthetic data
                if cache:
                    with open(cache_file, 'w') as f:
                        json.dump(publication_data, f)

                return publication_data
            else:
                return {
                    'abstract': "",
                    'results': "",
                    'conclusion': "",
                    'full_text': "",
                    'source': 'error',
                    'status': 'error',
                    'error': str(e),
                    'timestamp': time.time()
                }

    def extract_keywords(self, text, n=10):
        """Extract most important keywords from text."""
        if not text:
            return []

        # Simple tokenization if NLTK tokenize fails
        try:
            words = word_tokenize(text.lower())
        except Exception:
            # Fallback to simple tokenization
            words = re.findall(r'\b\w+\b', text.lower())

        filtered_words = [word for word in words if word.isalpha() and word not in self.stop_words]

        # Count frequency
        word_freq = Counter(filtered_words)

        # Return most common words
        return word_freq.most_common(n)

    def build_knowledge_graph(self, num_publications=None, use_cache=True):
        """Build a knowledge graph from the publications."""
        if num_publications is None:
            num_publications = len(self.publications_df)
        else:
            num_publications = min(num_publications, len(self.publications_df))

        cache_file = os.path.join(self.cache_dir, "knowledge_graph.json")

        # Use cached graph if available
        if use_cache and os.path.exists(cache_file):
            try:
                graph_data = json.load(open(cache_file))
                self.knowledge_graph = nx.node_link_graph(graph_data)
                print(f"Loaded cached knowledge graph with {len(self.knowledge_graph.nodes())} nodes")
                return self.knowledge_graph
            except:
                print("Failed to load cached graph, rebuilding...")

        print(f"Building knowledge graph from {num_publications} publications...")

        # Process publications to build the graph
        for index, row in self.publications_df.head(num_publications).iterrows():
            title = row['Title']
            url = row['Link']

            # Fetch publication content
            content = self.fetch_publication_content(url)

            # Identify top themes for this publication
            publication_themes = self.identify_publication_themes(title, content, num_themes=5)

            # Add publication node with themes as an attribute
            self.knowledge_graph.add_node(title, type='publication', url=url, themes=publication_themes)

            # Extract keywords from abstract and conclusion
            abstract_keywords = self.extract_keywords(content['abstract'])
            conclusion_keywords = self.extract_keywords(content['conclusion'])

            # Add keyword nodes and edges
            for keyword, count in abstract_keywords:
                if len(keyword) > 3:  # Skip very short words
                    self.knowledge_graph.add_node(keyword, type='keyword')
                    self.knowledge_graph.add_edge(title, keyword, weight=count, section='abstract')

            for keyword, count in conclusion_keywords:
                if len(keyword) > 3:  # Skip very short words
                    self.knowledge_graph.add_node(keyword, type='keyword')
                    self.knowledge_graph.add_edge(title, keyword, weight=count, section='conclusion')

        # Save the graph to cache
        try:
            graph_data = nx.node_link_data(self.knowledge_graph)
            with open(cache_file, 'w') as f:
                json.dump(graph_data, f)
        except:
            print("Failed to cache the knowledge graph")

        print(f"Knowledge graph built with {len(self.knowledge_graph.nodes())} nodes")
        return self.knowledge_graph

    def get_similar_publications(self, title, n=5):
        """Find publications similar to the given title."""
        # Simple implementation: find publications sharing keywords
        if title not in self.knowledge_graph:
            return []

        # Get keywords associated with this publication
        keywords = [node for node in self.knowledge_graph.neighbors(title)
                    if self.knowledge_graph.nodes[node]['type'] == 'keyword']

        # Find other publications connected to these keywords
        similar_pubs = {}
        for keyword in keywords:
            for node in self.knowledge_graph.neighbors(keyword):
                if node != title and self.knowledge_graph.nodes[node]['type'] == 'publication':
                    similar_pubs[node] = similar_pubs.get(node, 0) + 1

        # Sort by number of shared keywords
        similar_pubs = sorted(similar_pubs.items(), key=lambda x: x[1], reverse=True)[:n]
        return similar_pubs

    def identify_research_clusters(self):
        """Identify clusters of related research in the knowledge graph."""
        # Use community detection algorithm
        try:
            import community as community_louvain
            partition = community_louvain.best_partition(self.knowledge_graph)

            # Group publications by community
            communities = {}
            for node, community_id in partition.items():
                if node in self.knowledge_graph.nodes and self.knowledge_graph.nodes[node].get('type') == 'publication':
                    if community_id not in communities:
                        communities[community_id] = []
                    communities[community_id].append(node)

            # Extract common themes for each community
            communities_with_themes = []
            for community_id, publications in communities.items():
                # Make sure we only process communities with publications
                if not publications:
                    continue

                # Find all keywords associated with publications in this community
                keyword_counts = {}
                for pub in publications:
                    # Make sure the publication exists in the graph
                    if pub in self.knowledge_graph:
                        for neighbor in self.knowledge_graph.neighbors(pub):
                            if self.knowledge_graph.nodes[neighbor].get('type') == 'keyword':
                                keyword_counts[neighbor] = keyword_counts.get(neighbor, 0) + 1

                # Get top keywords as themes
                top_keywords = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:5]
                themes = [kw for kw, count in top_keywords]

                # If no themes were found, try to extract them from the publication titles
                if not themes and publications:
                    # Extract keywords from titles
                    all_words = []
                    for pub in publications:
                        # Tokenize the title and filter out stop words
                        words = [word.lower() for word in re.findall(r'\b[a-zA-Z]{3,}\b', pub)
                                if word.lower() not in self.stop_words]
                        all_words.extend(words)

                    # Count frequencies
                    word_counts = Counter(all_words)
                    top_words = word_counts.most_common(5)
                    themes = [word for word, count in top_words if count > 0]

                communities_with_themes.append((community_id, publications, themes))

            # Sort communities by size
            sorted_communities = sorted(communities_with_themes, key=lambda x: len(x[1]), reverse=True)

            # Combine small clusters (those with less than 3 publications)
            # into larger ones based on theme similarity
            combined_communities = []
            small_clusters = []

            for cluster in sorted_communities:
                if len(cluster[1]) >= 3:
                    combined_communities.append(cluster)
                else:
                    small_clusters.append(cluster)

            # If we have small clusters, try to merge them with larger ones
            # or combine them together
            if small_clusters:
                if combined_communities:
                    # First try to merge with larger clusters based on themes
                    for small_cluster in small_clusters:
                        merged = False
                        small_id, small_pubs, small_themes = small_cluster

                        # Try to find a matching large cluster
                        for i, large_cluster in enumerate(combined_communities):
                            large_id, large_pubs, large_themes = large_cluster

                            # Check for theme overlap
                            theme_overlap = set(small_themes).intersection(set(large_themes))
                            if theme_overlap or not small_themes or not large_themes:
                                # Merge the small cluster into the large one
                                combined_communities[i] = (large_id, large_pubs + small_pubs, large_themes)
                                merged = True
                                break

                        # If we couldn't merge, add it as is
                        if not merged:
                            combined_communities.append(small_cluster)
                else:
                    # No large clusters exist, so combine small clusters together
                    if len(small_clusters) >= 2:
                        merged_pubs = []
                        merged_themes = set()
                        for c_id, pubs, themes in small_clusters:
                            merged_pubs.extend(pubs)
                            merged_themes.update(themes)
                        combined_communities.append((1, merged_pubs, list(merged_themes)[:5]))
                    else:
                        # Just one small cluster, add it as is
                        combined_communities.extend(small_clusters)

            # Re-sort after combining
            return sorted(combined_communities, key=lambda x: len(x[1]), reverse=True)

        except ImportError:
            # Fall back to a simpler approach if python-louvain is not installed
            connected_components = list(nx.connected_components(self.knowledge_graph))
            communities = {}

            for i, component in enumerate(connected_components):
                publications = [node for node in component
                                if node in self.knowledge_graph.nodes and
                                self.knowledge_graph.nodes[node].get('type') == 'publication']

                # Skip empty publication components
                if not publications:
                    continue

                # Find themes (common keywords) for this component
                themes = []
                # Count keywords in this component
                keyword_counts = {}
                for pub in publications:
                    for neighbor in self.knowledge_graph.neighbors(pub):
                        if neighbor in self.knowledge_graph.nodes and self.knowledge_graph.nodes[neighbor].get('type') == 'keyword':
                            keyword_counts[neighbor] = keyword_counts.get(neighbor, 0) + 1

                # Get top keywords as themes
                top_keywords = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:5]
                themes = [kw for kw, count in top_keywords]

                # If no themes were found, try to extract them from the publication titles
                if not themes:
                    # Extract keywords from titles
                    all_words = []
                    for pub in publications:
                        # Tokenize the title and filter out stop words
                        words = [word.lower() for word in re.findall(r'\b[a-zA-Z]{3,}\b', pub)
                                if word.lower() not in self.stop_words]
                        all_words.extend(words)

                    # Count frequencies
                    word_counts = Counter(all_words)
                    top_words = word_counts.most_common(5)
                    themes = [word for word, count in top_words if count > 0]

                communities[i] = (publications, themes)

            # Sort communities by size
            sorted_communities = sorted(communities.items(), key=lambda x: len(x[1][0]), reverse=True)

            # Combine small clusters
            combined_communities = []
            small_clusters = []

            for cluster_id, (publications, themes) in sorted_communities:
                if len(publications) >= 3:
                    combined_communities.append((cluster_id, publications, themes))
                else:
                    small_clusters.append((cluster_id, publications, themes))

            # Try to merge small clusters
            if small_clusters:
                if combined_communities:
                    # Try to merge with larger clusters
                    for small_id, small_pubs, small_themes in small_clusters:
                        merged = False
                        for i, (large_id, large_pubs, large_themes) in enumerate(combined_communities):
                            theme_overlap = set(small_themes).intersection(set(large_themes))
                            if theme_overlap or not small_themes or not large_themes:
                                combined_communities[i] = (large_id, large_pubs + small_pubs, large_themes)
                                merged = True
                                break

                        if not merged:
                            combined_communities.append((small_id, small_pubs, small_themes))
                else:
                    # No large clusters, combine small ones
                    if len(small_clusters) >= 2:
                        merged_pubs = []
                        merged_themes = set()
                        for _, pubs, themes in small_clusters:
                            merged_pubs.extend(pubs)
                            merged_themes.update(themes)
                        combined_communities.append((1, merged_pubs, list(merged_themes)[:5]))
                    else:
                        combined_communities.extend(small_clusters)

            # Re-sort after combining
            return sorted(combined_communities, key=lambda x: len(x[1]), reverse=True)

    def generate_graph_data_for_visualization(self):
        """Generate data format suitable for visualization with D3.js."""
        nodes = []
        links = []

        # Convert nodes
        for node in self.knowledge_graph.nodes():
            node_type = self.knowledge_graph.nodes[node].get('type', 'unknown')

            # For publication nodes, make node size based on degree (importance)
            if node_type == 'publication':
                size = 10 + self.knowledge_graph.degree(node)
                url = self.knowledge_graph.nodes[node].get('url', '')

                # Include themes with the publication node data
                themes = self.knowledge_graph.nodes[node].get('themes', [])

                nodes.append({
                    'id': node,
                    'name': node if len(node) < 50 else node[:47] + '...',
                    'type': node_type,
                    'size': size,
                    'url': url,
                    'themes': themes  # Add the themes to the node data
                })
            # For keyword nodes, make size based on frequency
            elif node_type == 'keyword':
                size = 5 + self.knowledge_graph.degree(node) * 2
                nodes.append({
                    'id': node,
                    'name': node,
                    'type': node_type,
                    'size': size
                })

        # Convert edges
        for source, target, data in self.knowledge_graph.edges(data=True):
            weight = data.get('weight', 1)
            section = data.get('section', 'unknown')
            links.append({
                'source': source,
                'target': target,
                'weight': weight,
                'section': section
            })

        return {'nodes': nodes, 'links': links}

    def get_publication_by_keyword(self, keyword):
        """Get all publications that contain a specific keyword."""
        publications = []

        # Try to find exact match
        for node in self.knowledge_graph.nodes():
            if self.knowledge_graph.nodes[node].get('type') == 'keyword' and keyword.lower() in node.lower():
                # Get all connected publications
                for neighbor in self.knowledge_graph.neighbors(node):
                    if self.knowledge_graph.nodes[neighbor].get('type') == 'publication':
                        publications.append({
                            'title': neighbor,
                            'url': self.knowledge_graph.nodes[neighbor].get('url', ''),
                            'keyword': node
                        })

        return publications

    def get_publications_by_keyword(self, keyword):
        """
        Find all publications associated with a specific keyword in the knowledge graph.

        Args:
            keyword (str): The keyword to search for

        Returns:
            list: List of dictionaries containing publication information
        """
        publications = []

        # Ensure the knowledge graph is built
        if not hasattr(self, 'knowledge_graph') or self.knowledge_graph.number_of_nodes() == 0:
            self.build_knowledge_graph()

        # Check if the keyword exists in the graph
        if keyword not in self.knowledge_graph:
            return publications

        # Get all neighboring nodes that are publications
        for node in self.knowledge_graph.neighbors(keyword):
            if self.knowledge_graph.nodes[node].get('type') == 'publication':
                # Find the publication URL in our dataframe
                pub_title = node
                url = None

                # Find the publication in our dataframe
                matches = self.publications_df[self.publications_df['Title'] == pub_title]
                if not matches.empty:
                    url = matches.iloc[0]['Link']

                publications.append({
                    'title': pub_title,
                    'url': url
                })

        return publications

    def identify_publication_themes(self, publication_title, content, num_themes=5):
        """Identify top themes for a specific publication using content analysis."""
        themes = []

        # Get text from different sections of the publication
        abstract_text = content.get('abstract', '')
        results_text = content.get('results', '')
        conclusion_text = content.get('conclusion', '')

        # Combine texts with different weights (giving more importance to abstract and conclusion)
        combined_text = abstract_text + ' ' + abstract_text + ' ' + conclusion_text + ' ' + conclusion_text + ' ' + results_text

        # First do simple tokenization that doesn't require NLTK resources
        # This ensures we always have a fallback
        simple_words = re.findall(r'\b[a-zA-Z]{4,}\b', combined_text.lower())
        simple_filtered_words = [word for word in simple_words if word not in self.stop_words]

        # Try more advanced tokenization if NLTK is available
        try:
            words = word_tokenize(combined_text.lower())
            filtered_words = [word for word in words if word.isalpha() and len(word) > 3 and word not in self.stop_words]
            print(f"Successfully tokenized text for {publication_title} - found {len(filtered_words)} words")
        except Exception as e:
            # If NLTK tokenization fails, use our simple tokenization result
            print(f"Error tokenizing text for {publication_title}: {e}")
            print(f"Using fallback tokenization - found {len(simple_filtered_words)} words")
            filtered_words = simple_filtered_words

        # If we have enough words for analysis, try TF-IDF approach
        if len(filtered_words) > 10:
            try:
                # Create a document for TF-IDF analysis
                documents = [' '.join(filtered_words)]

                # Add some other publications' abstracts as comparison documents
                sample_count = min(5, len(self.publications_df)-1)
                if sample_count > 0:  # Make sure we have other publications to compare with
                    for i, row in self.publications_df.sample(sample_count).iterrows():
                        if row['Title'] != publication_title:
                            try:
                                other_pub_content = self.fetch_publication_content(row['Link'], cache=True)
                                other_text = other_pub_content.get('abstract', '')
                                if other_text:
                                    # Use the same tokenization method as above for consistency
                                    other_simple_words = re.findall(r'\b[a-zA-Z]{4,}\b', other_text.lower())
                                    other_filtered = [w for w in other_simple_words if w not in self.stop_words]

                                    if len(other_filtered) > 0:
                                        documents.append(' '.join(other_filtered))
                            except Exception as e:
                                print(f"Error processing comparison document: {e}")
                                # Just continue with the next document
                                continue

                # Apply TF-IDF if we have at least one comparison document
                if len(documents) > 1:
                    vectorizer = TfidfVectorizer()
                    tfidf_matrix = vectorizer.fit_transform(documents)
                    feature_names = vectorizer.get_feature_names_out()

                    # Get scores for the first document (our target publication)
                    tfidf_scores = tfidf_matrix[0].toarray()[0]

                    # Get top keywords based on TF-IDF score
                    top_indices = tfidf_scores.argsort()[-num_themes*2:][::-1]
                    top_keywords = [(feature_names[i], tfidf_scores[i]) for i in top_indices]

                    # Filter for only meaningful themes (score > 0.1)
                    top_keywords = [kw for kw in top_keywords if kw[1] > 0.1][:num_themes]
                    themes = [kw[0] for kw in top_keywords]
                else:
                    # Not enough comparison documents, fall back to frequency analysis
                    word_freq = Counter(filtered_words)
                    themes = [word for word, _ in word_freq.most_common(num_themes)]
            except Exception as e:
                print(f"Error in theme extraction for {publication_title}: {e}")
                # Fall back to simple frequency count
                word_freq = Counter(filtered_words)
                themes = [word for word, _ in word_freq.most_common(num_themes)]
        else:
            # Not enough words for analysis, use simple frequency count
            word_freq = Counter(filtered_words)
            themes = [word for word, _ in word_freq.most_common(min(len(word_freq), num_themes))]

        # If we still don't have enough themes, extract from title
        if len(themes) < num_themes:
            title_words = [word.lower() for word in re.findall(r'\b[a-zA-Z]{3,}\b', publication_title)
                          if word.lower() not in self.stop_words]
            title_freq = Counter(title_words)
            additional_themes = [word for word, _ in title_freq.most_common(num_themes - len(themes))]
            themes.extend(additional_themes)

        # Make sure we return at least one theme, even if it's just from the title
        if not themes and title_words:
            themes = [title_words[0]]

        return themes[:num_themes]  # Ensure we return at most num_themes

    def search_publications_full_text(self, query, section=None, exact_match=False):
        """
        Search for publications by query text in the full content of publications.

        Args:
            query (str): The search query
            section (str, optional): Limit search to a specific section ('abstract', 'results', 'conclusion')
            exact_match (bool, optional): Whether to perform exact phrase matching

        Returns:
            list: List of dictionaries containing matching publication information
        """
        results = []
        query = query.lower()

        # Create a mapping from URL hash to publication data to lookup titles and URLs later
        url_hash_map = {}
        filename_to_url_map = {}

        for _, row in self.publications_df.iterrows():
            title = row['Title']
            url = row['Link']
            if url:  # Only add if URL is not empty
                # Store both the direct hash and the string representation of the hash
                url_hash = str(hash(url))
                url_hash_map[url_hash] = {'title': title, 'url': url}

                # Also add a mapping without the negative sign if it exists
                if url_hash.startswith('-'):
                    url_hash_map[url_hash[1:]] = {'title': title, 'url': url}

        # Get all cache files except the knowledge graph
        cache_files = [f for f in os.listdir(self.cache_dir)
                       if f.endswith('.json') and not f == 'knowledge_graph.json'
                       and not f.endswith('_raw.html')]

        # Process each cache file
        for filename in cache_files:
            try:
                # Extract the hash part from the filename
                file_hash = filename.split('.')[0]

                # Load the cached content
                cache_file = os.path.join(self.cache_dir, filename)
                with open(cache_file, 'r') as f:
                    content = json.load(f)

                # Find the publication data using the hash
                publication_data = url_hash_map.get(file_hash)

                # If we couldn't find the publication in our mapping, try to extract info from content
                if not publication_data:
                    # Try both with and without the negative sign
                    if file_hash.startswith('-'):
                        publication_data = url_hash_map.get(file_hash[1:])

                    # If still not found, try to match by title in the content
                    if not publication_data:
                        full_text = content.get('full_text', '').lower()

                        # Determine title and URL from publication content if possible
                        for index, row in self.publications_df.iterrows():
                            db_title = row['Title'].lower()
                            if db_title and db_title in full_text:
                                publication_data = {'title': row['Title'], 'url': row['Link']}
                                # Remember this mapping for future searches
                                url_hash_map[file_hash] = publication_data
                                break

                # Skip if we can't identify the publication
                if not publication_data:
                    continue

                # Get title and URL from our mapping
                title = publication_data['title']
                url = publication_data['url']

                # Determine which sections to search based on the section parameter
                search_texts = []
                matching_sections = []

                if section == 'abstract' or section is None:
                    abstract_text = content.get('abstract', '').lower()
                    if self._text_matches(abstract_text, query, exact_match):
                        search_texts.append(abstract_text)
                        matching_sections.append('abstract')

                if section == 'results' or section is None:
                    results_text = content.get('results', '').lower()
                    if self._text_matches(results_text, query, exact_match):
                        search_texts.append(results_text)
                        matching_sections.append('results')

                if section == 'conclusion' or section is None:
                    conclusion_text = content.get('conclusion', '').lower()
                    if self._text_matches(conclusion_text, query, exact_match):
                        search_texts.append(conclusion_text)
                        matching_sections.append('conclusion')

                # If no specific section is requested, also check full text
                if section is None and not matching_sections:
                    full_text = content.get('full_text', '').lower()
                    if self._text_matches(full_text, query, exact_match):
                        search_texts.append(full_text)
                        matching_sections.append('full text')

                # If we found matches in any of the searched sections
                if search_texts:
                    # Find context around the search term for better results display
                    context_snippets = []
                    for text, section_name in zip(search_texts, matching_sections):
                        snippets = self._extract_context_snippets(text, query, exact_match, max_snippets=2)
                        for snippet in snippets:
                            context_snippets.append({
                                'text': snippet,
                                'section': section_name
                            })

                    # Add to results if not already added (avoid duplicates)
                    if not any(r['title'] == title for r in results):
                        results.append({
                            'title': title,
                            'url': url,
                            'matching_sections': matching_sections,
                            'snippets': context_snippets[:3]  # Limit to 3 snippets max
                        })

            except Exception as e:
                print(f"Error searching in cache file {filename}: {e}")
                continue

        return results

    def _text_matches(self, text, query, exact_match=False):
        """Helper method to check if text matches a query using improved stemming."""
        if not text:
            return False

        if exact_match:
            # For exact phrase matching, look for the whole query
            return query in text
        else:
            # Initialize Porter stemmer for word stemming
            stemmer = PorterStemmer()

            # Tokenize and stem the text once for efficiency
            try:
                text_tokens = word_tokenize(text)
                text_stems = {stemmer.stem(word.lower()) for word in text_tokens}
            except Exception:
                # Fall back to simple splitting if NLTK tokenizing fails
                text_tokens = text.lower().split()
                text_stems = {stemmer.stem(word) for word in text_tokens}

            # Process each query word
            query_words = query.lower().split()
            for word in query_words:
                # Stem the query word
                word_stem = stemmer.stem(word)

                # Check if the stemmed word is in our stemmed text
                if word_stem in text_stems:
                    continue

                # If the word is very short, check for exact match
                if len(word) <= 3:
                    if not re.search(r'\b{}\b'.format(re.escape(word)), text):
                        return False
                else:
                    # Additional checks for common variations
                    found = False

                    # Check original word
                    if re.search(r'\b{}\b'.format(re.escape(word)), text):
                        found = True

                    # Check plural form (add 's')
                    if not found and re.search(r'\b{}\b'.format(re.escape(word + 's')), text):
                        found = True

                    # Check singular form (remove 's' if it ends with 's')
                    if not found and word.endswith('s') and re.search(r'\b{}\b'.format(re.escape(word[:-1])), text):
                        found = True

                    # Check for 'es' ending
                    if not found and word.endswith('es') and re.search(r'\b{}\b'.format(re.escape(word[:-2])), text):
                        found = True

                    # Check for 'ies' -> 'y' transformation
                    if not found and word.endswith('ies') and re.search(r'\b{}\b'.format(re.escape(word[:-3] + 'y')), text):
                        found = True

                    if not found:
                        return False

            return True

    def _extract_context_snippets(self, text, query, exact_match=False, context_chars=100, max_snippets=2):
        """Extract text snippets around the search term for context."""
        snippets = []

        # Initialize stemmer for stemming
        stemmer = PorterStemmer()
        query_stem = stemmer.stem(query.lower())

        if exact_match:
            # Find all occurrences of the exact phrase
            start_idx = 0
            while len(snippets) < max_snippets:
                idx = text.find(query, start_idx)
                if idx == -1:
                    break

                # Extract text around the match
                snippet_start = max(0, idx - context_chars)
                snippet_end = min(len(text), idx + len(query) + context_chars)
                snippet = text[snippet_start:snippet_end]

                # Add ellipsis to indicate truncation
                if snippet_start > 0:
                    snippet = "..." + snippet
                if snippet_end < len(text):
                    snippet = snippet + "..."

                snippets.append(snippet)
                start_idx = idx + len(query)
        else:
            # For non-exact matching, we'll try to find context around any matching word forms
            query_words = query.lower().split()

            # Process text to find best matches for each query word
            for word in query_words:
                if len(snippets) >= max_snippets:
                    break

                word_stem = stemmer.stem(word.lower())

                # Try finding variations of the word
                variations = [word]
                if len(word) > 3:
                    variations.extend([
                        word + 's',
                        word[:-1] if word.endswith('s') else '',
                        word[:-2] if word.endswith('es') else '',
                        word[:-3] + 'y' if word.endswith('ies') else ''
                    ])

                # Filter out empty variations
                variations = [v for v in variations if v]

                # Find the first occurrence of any variation
                for variation in variations:
                    # Skip variations that are too short
                    if not variation or len(variation) < 3:
                        continue

                    # Use word boundaries to find whole words
                    pattern = r'\b{}\b'.format(re.escape(variation))
                    match = re.search(pattern, text)

                    if match:
                        start_idx = match.start()
                        end_idx = match.end()

                        # Extract text around the match
                        snippet_start = max(0, start_idx - context_chars)
                        snippet_end = min(len(text), end_idx + context_chars)
                        snippet = text[snippet_start:snippet_end]

                        # Add ellipsis to indicate truncation
                        if snippet_start > 0:
                            snippet = "..." + snippet
                        if snippet_end < len(text):
                            snippet = snippet + "..."

                        snippets.append(snippet)
                        break

        return snippets

# Example usage
if __name__ == "__main__":
    csv_path = "../SB_publications/SB_publication_PMC.csv"
    processor = PublicationProcessor(csv_path)

    # Build knowledge graph from a small subset for testing
    processor.build_knowledge_graph(num_publications=20)

    # Print some statistics
    print(f"Total publications: {processor.get_publication_count()}")
    print(f"Graph nodes: {len(processor.knowledge_graph.nodes())}")
    print(f"Graph edges: {len(processor.knowledge_graph.edges())}")
