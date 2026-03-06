import sys
import os
from PIL import Image
 
# Use pypdf for fallback PDF splitting (we added this to requirements.txt earlier)
try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    pass
 
def split_fallback(file_path, output_dir):
    try:
        if not os.path.exists(file_path):
            print(f"Error: File not found at {file_path}", file=sys.stderr)
            sys.exit(1)
 
        base_name, ext = os.path.splitext(os.path.basename(file_path))
        ext = ext.lower()
        os.makedirs(output_dir, exist_ok=True)
 
        # 1. HANDLE TIFFS
        if ext in ['.tif', '.tiff']:
            with Image.open(file_path) as img:
                total_pages = getattr(img, "n_frames", 1)
                for i in range(total_pages):
                    img.seek(i)
                    output_path = os.path.join(output_dir, f"{base_name}_{i+1}{ext}")
                    img.save(output_path)
                print(f"Split {total_pages} pages successfully")
 
        # 2. HANDLE PDFS
        elif ext == '.pdf':
            reader = PdfReader(file_path)
            total_pages = len(reader.pages)
            for i in range(total_pages):
                writer = PdfWriter()
                writer.add_page(reader.pages[i])
                output_path = os.path.join(output_dir, f"{base_name}_{i+1}.pdf")
                with open(output_path, "wb") as output_pdf:
                    writer.write(output_pdf)
            print(f"Split {total_pages} pages successfully")
 
        # 3. FAIL FAST ON UNSUPPORTED FILES
        else:
            print(f"Unsupported fallback file type: {ext}", file=sys.stderr)
            sys.exit(1)
 
    except Exception as e:
        # If ANYTHING goes wrong (corrupted file, unreadable bytes), 
        # instantly catch it, print it to Node, and abort the process!
        print(f"Fallback Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
 
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python fallBackSplit.py <file_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    split_fallback(sys.argv[1], sys.argv[2])