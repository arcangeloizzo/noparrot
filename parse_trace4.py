import json
import sys

file_path = sys.argv[1]
with open(file_path, 'r') as f:
    data = json.load(f)

records = data.get('recording', {}).get('records', [])
if not records:
    print("No records found")
    sys.exit(1)

total_layout = 0
layout_max = 0
total_script = 0
total_frames = 0
frame_times = []

for e in records:
    t = e.get('type', '')
    dur = (e.get('endTime', 0) - e.get('startTime', 0)) * 1000
    if t == 'timeline-record-type-layout':
        total_layout += dur
        if dur > layout_max:
            layout_max = dur
    elif t == 'timeline-record-type-script':
        total_script += dur
    elif t == 'timeline-record-type-rendering-frame':
        total_frames += 1
        frame_times.append(dur)

print(f"Total Layout/Composite: {total_layout:.2f}ms")
print(f"Max single Layout: {layout_max:.2f}ms")
print(f"Total Script: {total_script:.2f}ms")
print(f"Total Frames: {total_frames}")

if frame_times:
    frame_times.sort(reverse=True)
    frames_under_30 = len([f for f in frame_times if f > 33.33]) # 30fps is ~33ms
    print(f"Frames < 30fps: {frames_under_30} / {total_frames}")
    print(f"Median frame: {frame_times[total_frames//2]:.2f}ms")

