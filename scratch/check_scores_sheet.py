import pandas as pd
import openpyxl

file_path = 'data/2568_RM&IC_OFI Improvement Plan_update_20260622_154253.xlsx'
wb = openpyxl.load_workbook(file_path, read_only=True)
for sheet in wb.sheetnames:
    print(f"Sheet: {sheet}")
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
        print("Columns:", list(df.columns)[:10])
        print("First 5 rows:")
        print(df.iloc[:5, :10])
        print("-" * 50)
    except Exception as e:
        print(f"Error reading {sheet}: {e}")
