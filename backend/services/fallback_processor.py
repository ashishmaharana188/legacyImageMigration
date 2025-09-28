
import os
import re
import pandas as pd
import sys
from PyPDF2 import PdfReader
from PIL import Image

def get_page_count(file_path):
    """Gets the page count of a PDF or TIFF file."""
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            with open(file_path, 'rb') as f:
                reader = PdfReader(f)
                return len(reader.pages)
        elif ext in ['.tif', '.tiff']:
            with Image.open(file_path) as img:
                return getattr(img, 'n_frames', 1)
        else:
            return "Unsupported File"
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return "PDF Error" if ext == '.pdf' else "Unsupported File"

def create_fallback_csv(excel_path):
    """
    Creates a fallback CSV with page counts for processed PDFs.
    """
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'output')
    processed_dir = os.path.join(os.path.dirname(__file__), '..', 'processed')

    if not os.path.exists(excel_path):
        print(f"Error: Excel file not found at {excel_path}")
        return

    try:
        input_df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return

    # Create a map of id_ihno to file paths
    file_map = {}
    for root, _, files in os.walk(output_dir):
        for file in files:
            match = re.search(r'(\d+)$', os.path.splitext(file)[0])
            if match:
                id_ihno = int(match.group(1))
                file_map[id_ihno] = os.path.join(root, file)

    processed_rows = []
    for index, row in input_df.iterrows():
        id_ihno = row.get('id_ihno')
        new_row = row.to_dict()
        
        if pd.isna(id_ihno):
            new_row['page_count'] = "Missing id_ihno"
            processed_rows.append(new_row)
            continue

        id_ihno = int(id_ihno)
        if id_ihno in file_map:
            file_path = file_map[id_ihno]
            page_count = get_page_count(file_path)
            new_row['page_count'] = page_count
        else:
            new_row['page_count'] = "Not Found"
            
        processed_rows.append(new_row)

    if not processed_rows:
        print("No data to process.")
        return

    fallback_df = pd.DataFrame(processed_rows)
    
    required_columns = ['id_fund', 'id_trtype', 'id_ihno', 'id_path', 'id_acno', 'page_count']
    for col in required_columns:
        if col not in fallback_df.columns:
            fallback_df[col] = None
            
    fallback_df = fallback_df[required_columns]

    fallback_csv_path = os.path.join(processed_dir, 'processed_fallback.csv')
    try:
        fallback_df.to_csv(fallback_csv_path, index=False)
        print(f"Fallback CSV created successfully at: {fallback_csv_path}")
    except Exception as e:
        print(f"Error writing fallback CSV: {e}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        create_fallback_csv(sys.argv[1])
    else:
        print("Please provide the path to the Excel file.")
