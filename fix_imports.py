import sys
import re

# Fix ToastContainer.tsx
with open('cms/src/components/ToastContainer.tsx', 'r') as f:
    content = f.read()
content = content.replace("import { Toast } from '../hooks/useToast';", "import type { Toast } from '../hooks/useToast';")
with open('cms/src/components/ToastContainer.tsx', 'w') as f:
    f.write(content)

# Fix Dashboard.tsx
with open('cms/src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# Remove unused react imports
content = content.replace("import React, { useState, useRef, useCallback } from 'react';", "import React, { useState } from 'react';")

# Remove unused lucide-react imports
content = content.replace("Plus, ChevronLeft, ChevronRight, Upload, Trash2, CheckCircle2, AlertCircle", "Plus, ChevronLeft, ChevronRight")

# Remove NewShowState and NewEpisodeState imports entirely, since they aren't used
content = content.replace("import { CreateShowModal, NewShowState } from '../components/CreateShowModal';", "import { CreateShowModal } from '../components/CreateShowModal';")
content = content.replace("import { CreateEpisodeModal, NewEpisodeState } from '../components/CreateEpisodeModal';", "import { CreateEpisodeModal } from '../components/CreateEpisodeModal';")

with open('cms/src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)

print("Fixed imports")
