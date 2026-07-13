import json
import sys

file_path = sys.argv[1]
with open(file_path, 'r') as f:
    data = json.load(f)

records = data.get('recording', {}).get('records', [])
if not records:
    print("No records found in recording.records")
    sys.exit(1)

total_layout = 0
total_composite = 0
total_script = 0

layout_records = []
composite_records = []

for e in records:
    t = e.get('type', '')
    dur = (e.get('endTime', 0) - e.get('startTime', 0)) * 1000 # ms
    if t == 'Layout':
        total_layout += dur
        layout_records.append(dur)
    elif t == 'Composite':
        total_composite += dur
        composite_records.append(dur)
    elif t in ['EvaluateScript', 'FunctionCall', 'TimerFire', 'EventDispatch']:
        total_script += dur

print(f"Total Layout time: {total_layout:.2f}ms")
print(f"Total Composite time: {total_composite:.2f}ms")
print(f"Total Script time: {total_script:.2f}ms")

if layout_records:
    print(f"Max single layout: {max(layout_records):.2f}ms")
if composite_records:
    print(f"Max single composite: {max(composite_records):.2f}ms")
