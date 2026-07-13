import json

with open('recording.json', 'r') as f:
    data = json.load(f)

records = data['recording']['records']

gc_events = [e for e in records if 'garbage' in str(e).lower()]
comp_events = [e for e in records if 'composite' in str(e).lower()]

print(f"Total records: {len(records)}")
print(f"Found {len(gc_events)} GC events")
print(f"Found {len(comp_events)} Composite events")

# Safari stores type in e['type']
gc_records = [e for e in records if e.get('type') == 'GarbageCollection']
print(f"Found {len(gc_records)} actual GC records")

if gc_records:
    # Sort by duration to find the 1225ms one
    gc_records.sort(key=lambda x: x.get('endTime', 0) - x.get('startTime', 0), reverse=True)
    top_gc = gc_records[0]
    dur = top_gc.get('endTime', 0) - top_gc.get('startTime', 0)
    print(f"Top GC duration: {dur * 1000}ms")
    print("Top GC Event:", json.dumps(top_gc, indent=2)[:1000])

comp_records = [e for e in records if 'Composite' in e.get('type', '')]
print(f"Found {len(comp_records)} actual Composite records")

if comp_records:
    comp_records.sort(key=lambda x: x.get('endTime', 0) - x.get('startTime', 0), reverse=True)
    top_comp = comp_records[0]
    dur = top_comp.get('endTime', 0) - top_comp.get('startTime', 0)
    print(f"Top Composite duration: {dur * 1000}ms")
    print("Top Composite Event:", json.dumps(top_comp, indent=2)[:1000])
