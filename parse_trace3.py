import json
import sys
from collections import Counter

file_path = sys.argv[1]
with open(file_path, 'r') as f:
    data = json.load(f)

records = data.get('recording', {}).get('records', [])
if not records:
    print("No records found")
    sys.exit(1)

types = Counter([r.get('type') for r in records])
print("Event types:", types.most_common(10))

for r in records:
    if 'Layout' in str(r) or 'Composite' in str(r):
        print("Sample related record:", json.dumps(r, indent=2))
        break

