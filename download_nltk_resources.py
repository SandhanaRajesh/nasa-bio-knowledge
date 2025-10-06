#!/usr/bin/env python
"""
Script to download all necessary NLTK resources for the NASA Bio-Knowledge application.
"""
import nltk
import ssl

# Fix SSL certificate issues for NLTK downloads if needed
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

print("Downloading necessary NLTK resources...")

# Download required resources for text processing
nltk.download('punkt')  # For word tokenization
nltk.download('stopwords')  # For stopword filtering

# Download additional resources that might be needed
try:
    nltk.download('punkt_tab')  # Specific tokenizer mentioned in the error
except Exception as e:
    print(f"Warning: Could not download punkt_tab: {e}")
    print("This is okay, the application will use fallback tokenization methods.")

print("\nNLTK resources download complete.")
print("You can now run rebuild_cache.py or app.py to build the knowledge graph.")
