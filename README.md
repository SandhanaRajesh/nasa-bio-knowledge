# NASA Astro Biology Knowledge Engine

## Project Overview
The NASA Space Biology Knowledge Engine (LUNAR) is an interactive web application that processes and analyzes NASA's space biology publications to create a comprehensive knowledge base. It enables scientists, mission planners, and educators to explore biological research conducted in space environments through an intuitive interface featuring knowledge graphs, research clusters, and advanced search capabilities.

## Features
- **Knowledge Graph Visualization**: Interactive network visualization of connections between research topics, biological factors, and findings
- **Research Clusters**: Grouping of related publications using topic modeling and natural language processing
- **Advanced Search**: Full-text search with filters for publication metadata
- **Multi-user Interface**: Tailored views for scientists, mission planners, and educators
- **Publication Trends**: Visual analysis of research trends over time

## Technology Stack
- **Backend**: Python 3.x with Flask web framework
- **Data Processing**: pandas, NLTK, scikit-learn for text analysis and topic modeling
- **Knowledge Representation**: NetworkX for building and analyzing knowledge graphs
- **Frontend**: HTML, CSS (Bootstrap 5), JavaScript
- **Visualization**: D3.js and custom visualization libraries

## Project Structure
```
nasa-bio-knowledge/
├── backend/                # Python backend code
│   ├── app.py              # Flask application
│   ├── data_processor.py   # Publication data processing
│   └── date_extractor.py   # Utility for extracting dates
├── data/                   # Data files and cache
│   └── cache/              # Cached publication content
├── SB_publications/        # NASA Space Biology publication dataset
│   └── SB_publication_PMC.csv  # Publication metadata
├── static/                 # Static web assets
│   ├── css/                # Stylesheets
│   ├── images/             # Image assets
│   └── js/                 # JavaScript files
├── templates/              # HTML templates
│   ├── dashboard.html      # Dashboard interface
│   └── index.html          # Landing page
├── download_nltk_resources.py  # Script to download required NLTK data
└── rebuild_cache.py        # Script to rebuild publication cache
```

## Installation

### Prerequisites
- Python 3.9+
- Node.js 14+ (for frontend development)
- Access to internet for downloading NLTK resources

### Setup
1. Clone the repository
   ```bash
   git clone https://github.com/SandhanaRajesh/nasa-bio-knowledge.git
   cd nasa-bio-knowledge
   ```

2. **Important**: Download the required dataset file
   The application requires the SB_publication_PMC.csv file which is not included in this repository.
   You must download it from: https://github.com/jgalazka/SB_publications/tree/main
   
   ```bash
   # Create the SB_publications directory if it doesn't exist
   mkdir -p SB_publications
   
   # Download the CSV file (you may need to adjust this if direct download doesn't work)
   curl -o SB_publications/SB_publication_PMC.csv https://raw.githubusercontent.com/jgalazka/SB_publications/main/SB_publication_PMC.csv
   ```

3. Create required directory structure
   ```bash
   # Create the data/cache directory for storing publication cache
   mkdir -p data/cache
   ```

4. Create and activate a virtual environment
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

5. Install Python dependencies
   ```bash
   pip install -r requirements.txt
   ```

6. Download required NLTK resources
   ```bash
   python download_nltk_resources.py
   ```

7. Build publication cache (this may take some time)
   ```bash
   python rebuild_cache.py
   ```

## Usage

1. Start the Flask application
   ```bash
   python backend/app.py
   ```

2. Open your web browser and navigate to `http://localhost:5000`

3. Use the interface to:
   - Search for publications by keyword
   - Explore the knowledge graph
   - Analyze research clusters
   - View publication trends

## Data Source
The application uses a curated dataset of NASA Space Biology publications located in the `SB_publications` directory. This dataset contains metadata for approximately 608 publications including titles, abstracts, authors, and links to full-text articles on PubMed Central.

## Development

### Adding New Features
1. Create a feature branch from main
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Implement your changes
3. Test thoroughly
4. Create a pull request

### Code Style
- Python: Follow PEP 8 guidelines
- JavaScript: Use ES6+ features with consistent formatting
- HTML/CSS: Follow BEM naming conventions

## License
[Specify license information here]

## Contributors
[List contributors here]

## Acknowledgments
- NASA Space Biology Program for providing the publication dataset
- Open-source community for tools and libraries used in this project
