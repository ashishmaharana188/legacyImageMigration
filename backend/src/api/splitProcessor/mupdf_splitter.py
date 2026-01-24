import fitz  # PyMuPDF
import sys
import os
from PIL import Image

def split_document(file_path, output_dir):
    try:
        if not os.path.exists(file_path):
            print(f"Error: File not found at {file_path}", file=sys.stderr)
            sys.exit(1)

        file_name = os.path.basename(file_path)
        base_name, ext = os.path.splitext(file_name)
        ext = ext.lower()
        
        os.makedirs(output_dir, exist_ok=True)

        if ext == '.pdf':
            # Use a context manager (with) or ensure doc remains open for the duration
            doc = fitz.open(file_path)
            total_pages = len(doc)
            
            for i in range(total_pages):
                new_doc = fitz.open()
                # Logical Bridge: Extracting page 'i' from source to memory-resident new_doc
                new_doc.insert_pdf(doc, from_page=i, to_page=i)
                output_path = os.path.join(output_dir, f"{base_name}_{i + 1}.pdf")
                new_doc.save(output_path)
                new_doc.close()
            
            doc.close()
            # Node.js expects this exact string format for regex parsing
            print(f"Split {total_pages} pages successfully.")

        elif ext in ['.tif', '.tiff']:
            # For TIFFs, we use Pillow (PIL)
            with Image.open(file_path) as img:
                total_pages = getattr(img, "n_frames", 1)
                for i in range(total_pages):
                    img.seek(i)
                    output_path = os.path.join(output_dir, f"{base_name}_{i + 1}{ext}")
                    # Save individual frame
                    img.save(output_path)
                
                print(f"Split {total_pages} pages successfully.")
        else:
            print(f"Unsupported file type: {ext}", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        # Send error to stderr so Node.js logger picks it up as an error
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python mupdf_splitter.py <file_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    
    split_document(sys.argv[1], sys.argv[2])