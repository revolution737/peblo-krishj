import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// For Viewer UI, we only interact with public endpoints (no auth needed)
// GET /catalog and GET /catalog/search
export default api;
