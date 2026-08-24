import os

def replace_in_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, 'w') as f:
        f.write(content)

replace_in_file('app/main.py', [
    ('except Exception as e:', 'except Exception:')
])

replace_in_file('app/routers/artwork.py', [
    ('from typing import Optional\n', ''),
    ('    return\n', '')
])

replace_in_file('app/routers/catalog.py', [
    ('from typing import Optional\n', '')
])

replace_in_file('app/routers/episodes.py', [
    ('from typing import Optional\n', '')
])

replace_in_file('app/routers/seasons.py', [
    ('from typing import Optional\n', '')
])

replace_in_file('app/routers/shows.py', [
    ('from typing import Optional\n', '')
])

replace_in_file('app/schemas/catalog.py', [
    ('from typing import Any, Optional\n', 'from typing import Any\n')
])

replace_in_file('app/schemas/common.py', [
    ('from typing import List, Optional\n', '')
])

replace_in_file('app/services/audit.py', [
    ('from typing import Optional\n', '')
])

print("Fixes applied successfully.")
