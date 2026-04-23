const AUTH_KEY = "isLoggedIn";
const AUTH_EMAIL_KEY = "loggedInEmail";
const AUTH_USER_DETAILS_KEY = "loggedInUserDetails";

export const setLoggedInUser = (email, userDetails = null) => {
    localStorage.setItem(AUTH_KEY, "true");

    if (email) {
        localStorage.setItem(AUTH_EMAIL_KEY, email);
    }

    if (userDetails) {
        localStorage.setItem(AUTH_USER_DETAILS_KEY, JSON.stringify(userDetails));
    }
};

export const isUserLoggedIn = () => localStorage.getItem(AUTH_KEY) === "true";

export const getLoggedInEmail = () => localStorage.getItem(AUTH_EMAIL_KEY) || "";

export const getLoggedInUserDetails = () => {
    const raw = localStorage.getItem(AUTH_USER_DETAILS_KEY);

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error("Failed to parse stored user details", error);
        localStorage.removeItem(AUTH_USER_DETAILS_KEY);
        return null;
    }
};

export const clearLoggedInUser = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
    localStorage.removeItem(AUTH_USER_DETAILS_KEY);
};
