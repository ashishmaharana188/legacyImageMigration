
import fitz  # PyMuPDF
import sys
import os
from PIL import Image

def split_document(file_path, output_dir):
    try:
        file_name = os.path.basename(file_path)
        base_name, ext = os.path.splitext(file_name)
        
        os.makedirs(output_dir, exist_ok=True)

        if ext.lower() in ['.pdf']:
            doc = fitz.open(file_path)
            for i, page in enumerate(doc):
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=i, to_page=i)
                output_path = os.path.join(output_dir, f"{base_name}_{i + 1}{ext}")
                new_doc.save(output_path)
                new_doc.close()
            doc.close()
            print(f"Split {len(doc)} pages successfully.")
        elif ext.lower() in ['.tif', '.tiff']:
            img = Image.open(file_path)
            total_pages = getattr(img, "n_frames", 1)
            for i in range(total_pages):
                img.seek(i)
                output_path = os.path.join(output_dir, f"{base_name}_{i + 1}{ext}")
                img.save(output_path, save_all=False)
            print(f"Split {total_pages} pages successfully.")
        else:
            print("Unsupported file type.")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python mupdf_splitter.py <file_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    output_dir = sys.argv[2]
    split_document(file_path, output_dir)
