#!/usr/bin/env python
"""
Script to rebuild the knowledge graph cache with publication themes.
"""
import os
from backend.data_processor import PublicationProcessor
import time

# Path to publications CSV
csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'SB_publications', 'SB_publication_PMC.csv')

# Initialize the processor
print("Initializing publication processor...")
processor = PublicationProcessor(csv_path)

# Get the total count of publications
total_publications = processor.get_publication_count()
print(f"Found {total_publications} total publications in the dataset")

# Use all publications in the graph
num_publications = total_publications  # Use all available publications

print(f"Building knowledge graph with all {num_publications} publications...")
print("This may take some time depending on how many publications need to be processed...")
print("Publications that have been cached previously will load faster.")

# Start time for tracking
start_time = time.time()

# Force rebuild by setting use_cache=False for the graph, but we'll still use cached publication content
processor.build_knowledge_graph(num_publications=num_publications, use_cache=False)

# Calculate elapsed time
elapsed_time = time.time() - start_time
minutes, seconds = divmod(elapsed_time, 60)

print(f"\nKnowledge graph built successfully in {int(minutes)} minutes and {int(seconds)} seconds")
print(f"Graph statistics:")
print(f"- Total nodes: {processor.knowledge_graph.number_of_nodes()}")
print(f"- Total edges: {processor.knowledge_graph.number_of_edges()}")
print(f"- Publication nodes: {len([n for n, attr in processor.knowledge_graph.nodes(data=True) if attr.get('type') == 'publication'])}")
print(f"- Keyword nodes: {len([n for n, attr in processor.knowledge_graph.nodes(data=True) if attr.get('type') == 'keyword'])}")
print("\nCache has been successfully rebuilt with publication themes!")
print("The next time you access the dashboard, the complete knowledge graph will be used.")
