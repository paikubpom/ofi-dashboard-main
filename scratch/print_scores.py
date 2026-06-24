import pandas as pd
file_path = 'data/2568_RM&IC_OFI Improvement Plan_update_20260622_154253.xlsx'
df = pd.read_excel(file_path, sheet_name=1) # 2nd sheet

# Let's dump all non-empty rows as a list of lists/dicts to inspect
data_list = []
for index, row in df.iterrows():
    row_vals = [str(x) if pd.notnull(x) else "" for x in row.values]
    if any(val != "" for val in row_vals):
        data_list.append((index, row_vals))

for idx, vals in data_list:
    print(f"Row {idx:02d}: {vals}")
