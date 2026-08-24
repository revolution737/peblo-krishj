import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// For Viewer UI, we only interact with public endpoints (no auth needed)
// GET /catalog and GET /catalog/search
export default api;
