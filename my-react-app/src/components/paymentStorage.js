const API_URL = "/api/payment";

const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

    if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
};

export const getRazorpayConfig = async () => {
    const response = await fetch(`${API_URL}/config`);
    return parseResponse(response);
};

export const createRazorpayOrder = async ({ email, receipt }) => {
    const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, receipt }),
    });

    return parseResponse(response);
};

export const verifyRazorpayPayment = async (payload) => {
    const response = await fetch(`${API_URL}/verify-payment`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return parseResponse(response);
};