const API_BASE_URL = "http://localhost:5000";

const getImageUrl = (imagePath) => {
    if (!imagePath) return "";

    const normalizedPath = String(imagePath).trim().replace(/\\/g, "/");

    if (/^https?:\/\//i.test(normalizedPath)) {
        return normalizedPath;
    }

    const cleanPath = normalizedPath.replace(/^\/+/, "");

    if (cleanPath.startsWith("uploads/")) {
        return `${API_BASE_URL}/${cleanPath}`;
    }

    return `${API_BASE_URL}/uploads/${cleanPath}`;
};

export default getImageUrl;