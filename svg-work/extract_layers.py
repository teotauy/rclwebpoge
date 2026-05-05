"""
Extract color layers from the Red Crow Labs logo PNG.
Outputs black-on-white BMPs for potrace to trace.

Actual colors in the logo (from histogram):
  #A42611  (164, 38, 17)  — main crimson body, ~152K pixels
  #6D1D12  (109, 29, 18)  — dark shadow/feather detail, ~14K pixels
  #B23626  (178, 54, 38)  — mid highlight, ~4K pixels
  #000000  (  0,  0,  0)  — black background
"""
from PIL import Image
import numpy as np

img = Image.open("../red-crow-labs-logo.png").convert("RGB")
arr = np.array(img, dtype=np.float32)

def extract(target_rgb, threshold=40, out_file="out.bmp"):
    t = np.array(target_rgb, dtype=np.float32)
    dist = np.sqrt(np.sum((arr - t) ** 2, axis=2))
    # Target color → 0 (black for potrace), everything else → 255 (white)
    mask = np.where(dist < threshold, 0, 255).astype(np.uint8)
    Image.fromarray(mask, mode="L").save(out_file)
    count = np.sum(dist < threshold)
    print(f"  {out_file}: {count} pixels matched")

print("Extracting layers...")
# All red content (any non-black pixel with saturation)
arr_rgb = arr
is_red = (arr_rgb[:,:,0] > 60) & (arr_rgb[:,:,0] > arr_rgb[:,:,2] * 2)
silhouette = np.where(is_red, 0, 255).astype(np.uint8)
Image.fromarray(silhouette, mode="L").save("layer-silhouette.bmp")
print(f"  layer-silhouette.bmp: {np.sum(is_red)} pixels")

extract((164, 38, 17), threshold=45, out_file="layer-bright.bmp")
extract((109, 29, 18), threshold=35, out_file="layer-dark.bmp")
extract((178, 54, 38), threshold=35, out_file="layer-mid.bmp")

print("Done.")
