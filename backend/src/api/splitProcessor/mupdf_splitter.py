import sys
import os
import fitz  # PyMuPDF
 
def split_document(input_path, output_folder):
    try:
        # PyMuPDF natively opens PDFs, TIFFs, JPGs, etc.
        doc = fitz.open(input_path)
        base_name, ext = os.path.splitext(os.path.basename(input_path))
        ext = ext.lower()
        
        page_count = len(doc)
        
        for i in range(page_count):
            out_filename = f"{base_name}_{i+1}{ext}"
            out_filepath = os.path.join(output_folder, out_filename)
            
            if ext in ['.tif', '.tiff']:
                # For TIFFs: Extract the page as an image (Pixmap)
                pix = doc[i].get_pixmap()
                
                # PyMuPDF uses pil_save to safely encode and write TIFF formats
                # (Requires Pillow to be installed in your Python environment)
                pix.pil_save(out_filepath)
                
            else:
                # For PDFs: Create a new PDF document and insert the single page
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=i, to_page=i)
                new_doc.save(out_filepath)
                new_doc.close()
                
        doc.close()
        
        # This exact string tells Node.js the extraction was successful
        print(f"Split {page_count} pages successfully")
        sys.stdout.flush()
        
    except Exception as e:
        # If anything fails, print to stderr so the Node.js logger catches it!
        print(f"Error splitting document: {str(e)}", file=sys.stderr)
        sys.exit(1)
 
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python mupdf_splitter.py <input_file> <output_folder>", file=sys.stderr)
        sys.exit(1)
 
    input_file = sys.argv[1]
    output_folder = sys.argv[2]
    
    split_document(input_file, output_folder)