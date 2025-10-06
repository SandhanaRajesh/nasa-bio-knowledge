import re
import os
import json
import glob
from datetime import datetime

def extract_date_from_text(text):
    """
    Extract publication date from publication text using regex patterns.
    Returns a string in YYYY-MM-DD format if found, otherwise None.
    """
    # Pattern matching common journal citation formats
    patterns = [
        # Format: Journal Name. YYYY Mon DD;Vol(Issue):pages
        r'(?:[A-Za-z\s]+)\.\s+(\d{4})\s+([A-Za-z]{3,})\s+(\d{1,2});',
        # Format: YYYY Mon DD;Vol(Issue):pages
        r'(\d{4})\s+([A-Za-z]{3,})\s+(\d{1,2});',
        # Format: Published online YYYY Mon DD
        r'Published\s+online\s+(\d{4})\s+([A-Za-z]{3,})\s+(\d{1,2})',
        # Format: (YYYY Month)
        r'\((\d{4})\s+([A-Za-z]{3,})\)'
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                year = match.group(1)
                month = match.group(2)
                day = match.group(3) if len(match.groups()) >= 3 else "1"  # Default to 1st day if no day specified

                # Convert month name to number
                try:
                    month_num = datetime.strptime(month[:3], '%b').month
                except ValueError:
                    # If month abbreviation fails, try full month name
                    try:
                        month_num = datetime.strptime(month, '%B').month
                    except ValueError:
                        month_num = 1  # Default to January if month parsing fails

                # Format as YYYY-MM-DD
                return f"{year}-{month_num:02d}-{int(day):02d}"
            except Exception as e:
                print(f"Error parsing date: {e}")
                continue

    # If no specific date found, try just year
    year_match = re.search(r'©\s*(\d{4})', text)
    if year_match:
        return f"{year_match.group(1)}-01-01"  # Default to Jan 1 if only year found

    # If still nothing, return current year as fallback
    return f"{datetime.now().year}-01-01"

def extract_title_from_json(json_data):
    """
    Extract the title from the JSON data.
    First tries to find it in the full_text using regex patterns,
    falls back to using the first sentence of the abstract.
    """
    if json_data.get("full_text"):
        # Look for title pattern after journal citation
        title_match = re.search(r'(?:PMID:|PMCID:).*?\n\n(.*?)\n', json_data["full_text"], re.DOTALL)
        if title_match:
            title = title_match.group(1).strip()
            return title

    # Fallback to first sentence of abstract
    if json_data.get("abstract"):
        # Split on period followed by space or newline, take first segment
        abstract_parts = re.split(r'\.(?:\s|\n)', json_data["abstract"], 1)
        if len(abstract_parts) > 0:
            return abstract_parts[0].strip()

    return "Unknown Title"

def extract_url_from_text(text):
    """
    Extract publication URL from the text.
    """
    # Look for PMC URL pattern
    url_match = re.search(r'https://www\.ncbi\.nlm\.nih\.gov/pmc/articles/PMC\d+/?', text)
    if url_match:
        return url_match.group(0)

    # Look for DOI pattern
    doi_match = re.search(r'doi:\s*(10\.\d{4,}[^;\s]+)', text)
    if doi_match:
        return f"https://doi.org/{doi_match.group(1)}"

    return None

def update_json_with_metadata():
    """
    Process all JSON files in the cache directory and update them with
    publicationUrl, publicationTitle, and publishedDate fields.
    """
    cache_dir = "/Users/E940338/IdeaProjects/nasa-bio-knowledge/data/cache"
    json_files = glob.glob(os.path.join(cache_dir, "*.json"))

    updated_count = 0
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Skip files that already have the metadata
            if all(key in data for key in ["publicationUrl", "publicationTitle", "publishedDate"]):
                continue

            # Extract metadata
            published_date = extract_date_from_text(data.get("full_text", ""))
            publication_title = extract_title_from_json(data)
            publication_url = extract_url_from_text(data.get("full_text", ""))

            # Add metadata to JSON
            data["publicationUrl"] = publication_url
            data["publicationTitle"] = publication_title
            data["publishedDate"] = published_date

            # Write updated JSON back to file
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)

            updated_count += 1

        except Exception as e:
            print(f"Error processing {json_file}: {e}")

    print(f"Updated {updated_count} JSON files with publication metadata")

if __name__ == "__main__":
    update_json_with_metadata()
