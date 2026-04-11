import pandas as pd
import sys

def generate_sql_from_excel(excel_file, sheet_name=0, table_name=None):
    """
    Generate SQL CREATE TABLE query from Excel file.
    
    Parameters:
    - excel_file: Path to Excel file
    - sheet_name: Sheet name or index (default: 0)
    - table_name: Name for the table (default: sheet name)
    """
    try:
        # Read Excel file
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        
        # Get table name from sheet if not provided
        if table_name is None:
            if isinstance(sheet_name, int):
                xls = pd.ExcelFile(excel_file)
                table_name = xls.sheet_names[sheet_name]
            else:
                table_name = sheet_name
        
        # Clean table name (remove spaces, special chars)
        table_name = table_name.replace(' ', '_').replace('-', '_')
        
        # Expected columns: Field Name, Type, Null, Key
        required_columns = ['Field Name', 'Type', 'Null', 'Key']
        
        # Check if required columns exist (case-insensitive)
        df.columns = df.columns.str.strip()
        
        # Start building SQL
        sql_lines = [f"CREATE TABLE {table_name} ("]
        column_definitions = []
        primary_keys = []
        
        # Process each row
        for idx, row in df.iterrows():
            field_name = str(row.get('Field Name', '')).strip().replace(' ', '_')
            data_type = str(row.get('Type', '')).strip()
            is_null = str(row.get('Null', '')).strip().upper()
            key_type = str(row.get('Key', '')).strip().upper()
            if data_type=='String' or data_type=='Text' or data_type=='NVARCHAR(255)':
                data_type='NVARCHAR(255)'
            if data_type=='Decimal':
                data_type='DECIMAL(38,18)'
            if data_type=='Date' or data_type=='datetime':
                data_type='DATETIME'
            
            if not field_name or field_name == 'nan':
                continue
            
            # Build column definition
            col_def = f"    [{field_name}] {data_type}"
            
            # Add NULL/NOT NULL constraint
            if is_null in ['NO', 'N', 'NOT NULL']:
                col_def += " NOT NULL"
            elif is_null in ['YES', 'Y', 'NULL']:
                col_def += " NULL"
            
            # Check for primary key
            if key_type in ['PRI', 'PRIMARY', 'PK', 'PRIMARY KEY']:
                primary_keys.append(field_name)
            
            # Add AUTO_INCREMENT if mentioned in type or key
            if 'AUTO_INCREMENT' in data_type.upper() or 'AUTO_INCREMENT' in key_type:
                col_def += " AUTO_INCREMENT"
            
            column_definitions.append(col_def)
        
        # Add column definitions to SQL
        sql_lines.append(',\n'.join(column_definitions))
        
        # Add primary key constraint if exists
        if primary_keys:
            sql_lines.append(f",\n    PRIMARY KEY ({', '.join(primary_keys)})")
        
        sql_lines.append(");")
        
        # Combine all lines
        sql_query = '\n'.join(sql_lines)
        
        return sql_query
        
    except Exception as e:
        return f"Error: {str(e)}"


def main():
    # Example usage
    if len(sys.argv) < 2:
        print("Usage: python script.py <excel_file> [sheet_name] [table_name]")
        print("\nExample:")
        print("  python script.py schema.xlsx")
        print("  python script.py schema.xlsx Sheet1")
        print("  python script.py schema.xlsx 0 users")
        return
    
    excel_file = sys.argv[1]
    sheet_name = sys.argv[2] if len(sys.argv) > 2 else 0
    table_name = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Try to convert sheet_name to int if it's a number
    try:
        sheet_name = int(sheet_name)
    except (ValueError, TypeError):
        pass
    
    # Generate SQL
    sql = generate_sql_from_excel(excel_file, sheet_name, table_name)
    
    print(sql)
    
    # Optionally save to file
    output_file = excel_file.replace('.xlsx', '.sql').replace('.xls', '.sql')
    with open(output_file, 'w') as f:
        f.write(sql)
    print(f"\n\nSQL saved to: {output_file}")


if __name__ == "__main__":
    main()