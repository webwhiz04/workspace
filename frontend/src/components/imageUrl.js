const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getImageUrl = (imagePath) => {
    if (!imagePath) return "";

    const normalizedPath = String(imagePath).trim().replace(/\\/g, "/");

    // if already full URL (cloud/CDN)
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