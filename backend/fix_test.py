import os

filepath = 'tests/test_publish.py'
with open(filepath, 'r') as f:
    content = f.read()

old_content = """        mock_storage.copy = AsyncMock()
        mock_storage.atomic_replace = AsyncMock()"""

new_content = """        mock_storage.copy = AsyncMock(side_effect=lambda src, dst: written_texts.update({dst: written_texts.get(src, "")}))
        mock_storage.atomic_replace = AsyncMock(side_effect=lambda src, dst: written_texts.update({dst: written_texts.get(src, "")}))"""

content = content.replace(old_content, new_content)

with open(filepath, 'w') as f:
    f.write(content)
print("Updated tests/test_publish.py")
