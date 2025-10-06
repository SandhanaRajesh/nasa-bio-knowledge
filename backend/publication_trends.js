// API endpoint to get publication trends data
app.get('/api/publication-trends', async (req, res) => {
    try {
        const timeframe = req.query.timeframe || 3; // Default to 3 years
        const metric = req.query.metric || 'publication-count';

        // Get current date
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();

        // Calculate cutoff date based on timeframe (in years)
        const cutoffYear = currentYear - parseInt(timeframe);

        // Read all JSON files from cache directory
        const cacheDir = path.join(__dirname, '../data/cache');
        const jsonFiles = fs.readdirSync(cacheDir).filter(file => file.endsWith('.json'));

        // Process publication data
        const publicationsByYear = {};
        const keywordFrequency = {};
        const topKeywords = [];

        // Initialize publication years
        for (let year = cutoffYear; year <= currentYear; year++) {
            publicationsByYear[year] = 0;
        }

        // Process each publication
        for (const jsonFile of jsonFiles) {
            try {
                const fileContent = fs.readFileSync(path.join(cacheDir, jsonFile), 'utf8');
                const publication = JSON.parse(fileContent);

                // Skip if no publication date
                if (!publication.publishedDate) continue;

                // Extract year from publication date
                const pubYear = parseInt(publication.publishedDate.substring(0, 4));

                // Only count publications within the requested timeframe
                if (pubYear >= cutoffYear && pubYear <= currentYear) {
                    // Increment count for this year
                    if (publicationsByYear[pubYear]) {
                        publicationsByYear[pubYear]++;
                    } else {
                        publicationsByYear[pubYear] = 1;
                    }

                    // Extract keywords from abstract
                    if (publication.abstract) {
                        const keywords = extractKeywords(publication.abstract);
                        keywords.forEach(keyword => {
                            if (keywordFrequency[keyword]) {
                                keywordFrequency[keyword]++;
                            } else {
                                keywordFrequency[keyword] = 1;
                            }
                        });
                    }
                }
            } catch (err) {
                console.error(`Error processing file ${jsonFile}:`, err);
            }
        }

        // Sort keywords by frequency
        const sortedKeywords = Object.entries(keywordFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        // Calculate yearly growth rates
        const yearlyGrowthRates = calculateGrowthRates(publicationsByYear);

        // Return the processed data
        res.json({
            publicationsByYear,
            yearlyGrowthRates,
            topKeywords: sortedKeywords,
            timeframe
        });
    } catch (err) {
        console.error('Error getting publication trends:', err);
        res.status(500).json({ error: 'Failed to get publication trends data' });
    }
});

// Helper function to extract keywords from text
function extractKeywords(text) {
    // Extended list of stop words
    const stopWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of',
        'this', 'that', 'these', 'those', 'from', 'as', 'if', 'then', 'than', 'so', 'what', 'when', 'where', 'which',
        'who', 'whom', 'whose', 'how', 'why', 'abstract', 'while', 'because', 'since', 'until', 'unless', 'although',
        'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
        'may', 'might', 'must', 'can', 'could', 'about', 'above', 'across', 'after', 'against', 'along', 'among',
        'around', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'during', 'except', 'inside',
        'into', 'like', 'near', 'off', 'onto', 'out', 'over', 'past', 'through', 'throughout', 'under', 'underneath',
        'up', 'upon', 'within', 'without', 'not', 'no', 'nor', 'none', 'their', 'them', 'they', 'we', 'us', 'our',
        'ours', 'you', 'your', 'yours', 'him', 'his', 'her', 'hers', 'its', 'it', 'all', 'any', 'both', 'each',
        'either', 'few', 'many', 'more', 'most', 'much', 'other', 'others', 'several', 'some', 'such', 'study',
        'studies', 'research', 'paper', 'papers', 'article', 'articles', 'space', 'using', 'used', 'use', 'approach',
        'were', 'was', 'found', 'shown', 'showed', 'shows', 'show', 'data', 'results', 'result', 'also', 'however',
        'therefore', 'thus', 'hence', 'additionally', 'furthermore', 'moreover', 'figure', 'table', 'analysis'
    ]);

    // Ensure problematic words are always filtered out (double check)
    const problematicWords = ['abstract', 'that', 'this', 'space', 'from'];
    problematicWords.forEach(word => stopWords.add(word));

    // Process text
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');

    // Get all words (4+ characters) that aren't in stop words
    const words = new Set();
    const wordArray = cleanText.split(/\s+/);

    for (const word of wordArray) {
        if (word.length > 3 && !stopWords.has(word)) {
            words.add(word);
        }
    }

    // Add scientific terms if they're not stop words
    const scientificTermsRegex = /[A-Za-z][A-Za-z0-9\-]{3,}/g;
    let match;
    while ((match = scientificTermsRegex.exec(text)) !== null) {
        const term = match[0].toLowerCase();
        if (term.length > 3 && !stopWords.has(term)) {
            words.add(term);
        }
    }

    return Array.from(words);
}

// Helper function to calculate growth rates
function calculateGrowthRates(publicationsByYear) {
    const years = Object.keys(publicationsByYear).sort();
    const growthRates = {};

    for (let i = 1; i < years.length; i++) {
        const currentYear = years[i];
        const previousYear = years[i-1];

        const currentCount = publicationsByYear[currentYear];
        const previousCount = publicationsByYear[previousYear];

        if (previousCount > 0) {
            const growthRate = ((currentCount - previousCount) / previousCount) * 100;
            growthRates[currentYear] = growthRate.toFixed(1);
        } else {
            growthRates[currentYear] = currentCount > 0 ? 100 : 0; // If previous year was 0, set to 100% growth or 0
        }
    }

    return growthRates;
}
