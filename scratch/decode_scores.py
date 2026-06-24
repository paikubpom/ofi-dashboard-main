import openpyxl

wb = openpyxl.load_workbook('data/2568_RM&IC_OFI Improvement Plan_update_20260622_154253.xlsx', data_only=True)
sheet = wb.worksheets[1] # 2nd sheet

val = sheet.cell(3, 4).value
print("Raw value:", repr(val))
print("Bytes UTF-8:", val.encode('utf-8'))
# Let's try to convert each char to byte using ord() and then decode as cp874
try:
    decoded = bytes([ord(c) for c in val]).decode('cp874')
    print("Decoded cp874:", decoded)
except Exception as e:
    print("Error cp874:", e)
