const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const API_URLS = {
  AUTH: `${API_BASE_URL}/api/auth`,
  PRODUCTS: `${API_BASE_URL}/api/products`,
  USERDATA: `${API_BASE_URL}/api/userdata`,
  PAYMENT: `${API_BASE_URL}/api/payment`,
  UPLOADS: `${API_BASE_URL}/uploads`,
};

export default API_BASE_URL;
