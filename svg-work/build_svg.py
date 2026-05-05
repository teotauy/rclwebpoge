"""
Build composite animated SVG from potrace layers.
Analyzes path bounding boxes to identify logo regions.
"""
import re, sys

def extract_group(fname):
    with open(fname) as f:
        content = f.read()
    m = re.search(r'<g transform="([^"]+)"[^>]*>(.*?)</g>', content, re.DOTALL)
    if m:
        return m.group(2).strip()
    return ""

def get_paths(fname):
    content = extract_group(fname)
    return re.findall(r'<path d="([^"]+)"', content)

# potrace transform: translate(0,1024) scale(0.1,-0.1)
# Actual pixel coord: x_px = x_path * 0.1,  y_px = 1024 - y_path * 0.1
def sample_bounds(d_attr, samples=200):
    """Very rough bounding box: extract all M/L number pairs from path d."""
    nums = re.findall(r'[-+]?(?:\d+\.?\d*|\.\d+)', d_attr)
    floats = [float(n) for n in nums]
    # Pair up as x,y
    xs, ys = [], []
    for i in range(0, len(floats)-1, 2):
        x_px = floats[i] * 0.1
        y_px = 1024 - floats[i+1] * 0.1
        xs.append(x_px)
        ys.append(y_px)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs), max(ys))

silhouette_paths = get_paths("layer-silhouette.svg")
dark_group = extract_group("layer-dark.svg")

print("Silhouette paths and estimated bounding boxes:")
print(f"{'#':<4} {'x0':>6} {'y0':>6} {'x1':>6} {'y1':>6}  area")
for i, d in enumerate(silhouette_paths):
    b = sample_bounds(d)
    if b:
        x0,y0,x1,y1 = b
        area = (x1-x0)*(y1-y0)
        print(f"{i:<4} {x0:6.0f} {y0:6.0f} {x1:6.0f} {y1:6.0f}  {area:,.0f}")
    else:
        print(f"{i:<4} (no data)")
