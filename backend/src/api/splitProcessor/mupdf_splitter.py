import fitz  # PyMuPDF
import sys
import os
 
def split_document(file_path, output_dir):
    try:
        if not os.path.exists(file_path):
            print(f"Error: File not found at {file_path}", file=sys.stderr)
            sys.exit(1)
 
        file_name = os.path.basename(file_path)
        base_name, ext = os.path.splitext(file_name)
        ext = ext.lower()
        os.makedirs(output_dir, exist_ok=True)
 
        # Let PyMuPDF open EVERYTHING (PDFs and TIFFs) natively
        doc = fitz.open(file_path)
        total_pages = len(doc)
 
        if ext == '.pdf':
            for i in range(total_pages):
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=i, to_page=i)
                output_path = os.path.join(output_dir, f"{base_name}_{i + 1}.pdf")
                # [SPEED FIX]: garbage=0 and deflate=False skips re-compression 
                # and optimization, making the save operation virtually instant.
                new_doc.save(output_path, garbage=0, deflate=False)
                new_doc.close()
            # Node.js exact regex match
            print(f"Split {total_pages} pages successfully")
 
        elif ext in ['.tif', '.tiff']:
            for i in range(total_pages):
                output_path = os.path.join(output_dir, f"{base_name}_{i + 1}{ext}")
                # [SPEED FIX]: PyMuPDF extracts the frame via C-bindings instantly.
                pix = doc[i].get_pixmap()
                # pil_save safely hands the raw pixel data to Pillow for quick saving
                pix.pil_save(output_path)
            # Node.js exact regex match
            print(f"Split {total_pages} pages successfully")
        else:
            print(f"Unsupported file type: {ext}", file=sys.stderr)
            sys.exit(1)
        doc.close()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
 
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python mupdf_splitter.py <file_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    split_document(sys.argv[1], sys.argv[2])