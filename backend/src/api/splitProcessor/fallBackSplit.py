from PIL import Image, TiffImagePlugin
import sys
import os

# Get arguments from command line
file_path = sys.argv[1]
output_dir = sys.argv[2]

# Open the TIFF file
img = Image.open(file_path)

# Check if it's a multi-page TIFF
if isinstance(img, TiffImagePlugin.TiffImageFile):
    total_pages = getattr(img, "n_frames", 1)
    for i in range(total_pages):
        img.seek(i)
        output_path = os.path.join(
            output_dir, f"{os.path.basename(file_path).split('.')[0]}_{i+1}.tiff"
        )
        img.save(output_path)
    print(f"Split {total_pages} pages successfully.")
else:
    print("Not a multi-page TIFF.")
