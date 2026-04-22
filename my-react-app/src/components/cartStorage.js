const API_URL = "http://localhost:5000/api/userdata";

const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

    if (!response.ok) {
        console.error("API Error Response:", { status: response.status, data });
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
};

export const getCartItems = async (email) => {
    if (!email) {
        throw new Error("Email is required to fetch cart");
    }
    try {
        const response = await fetch(`${API_URL}/cart?email=${encodeURIComponent(email)}`);
        const data = await parseResponse(response);
        return Array.isArray(data.cartItems) ? data.cartItems : [];
    } catch (error) {
        console.error("getCartItems error for email:", email, error);
        throw error;
    }
};

export const addToCart = async (email, product) => {
    if (!email) {
        throw new Error("Email is required to add to cart");
    }
    const response = await fetch(`${API_URL}/cart/add`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, product }),
    });

    const data = await parseResponse(response);
    return Array.isArray(data.cartItems) ? data.cartItems : [];
};

export const updateCartQuantity = async (email, productId, quantity) => {
    if (!email) {
        throw new Error("Email is required to update cart");
    }
    const response = await fetch(`${API_URL}/cart/item`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, productId, quantity }),
    });

    const data = await parseResponse(response);
    return Array.isArray(data.cartItems) ? data.cartItems : [];
};

export const removeFromCart = async (email, productId) => {
    return updateCartQuantity(email, productId, 0);
};

export const placeOrder = async (email, shippingAddress) => {
    if (!email) {
        throw new Error("Email is required to place order");
    }
    const response = await fetch(`${API_URL}/orders/place`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, shippingAddress }),
    });

    return parseResponse(response);
};

export const getSavedShippingAddress = async (email) => {
    if (!email) {
        throw new Error("Email is required to fetch shipping address");
    }

    try {
        const response = await fetch(`${API_URL}/shipping-address?email=${encodeURIComponent(email)}`);
        const data = await parseResponse(response);
        return data.shippingAddress || null;
    } catch (error) {
        console.error("getSavedShippingAddress error for email:", email, error);
        throw error;
    }
};

export const getShippingAddresses = async (email) => {
    if (!email) {
        throw new Error("Email is required to fetch shipping addresses");
    }

    try {
        const response = await fetch(`${API_URL}/shipping-address?email=${encodeURIComponent(email)}`);
        const data = await parseResponse(response);

        if (Array.isArray(data.shippingAddresses) && data.shippingAddresses.length > 0) {
            return data.shippingAddresses;
        }

        return data.shippingAddress ? [data.shippingAddress] : [];
    } catch (error) {
        console.error("getShippingAddresses error for email:", email, error);
        throw error;
    }
};

export const saveShippingAddress = async (email, shippingAddress) => {
    if (!email) {
        throw new Error("Email is required to save shipping address");
    }

    const response = await fetch(`${API_URL}/shipping-address`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, shippingAddress }),
    });

    const data = await parseResponse(response);
    return {
        shippingAddress: data.shippingAddress || null,
        shippingAddresses: Array.isArray(data.shippingAddresses) ? data.shippingAddresses : [],
    };
};

export const getOrders = async (email) => {
    if (!email) {
        throw new Error("Email is required to fetch orders");
    }
    try {
        const response = await fetch(`${API_URL}/orders?email=${encodeURIComponent(email)}`);
        const data = await parseResponse(response);
        return Array.isArray(data.orders) ? data.orders : [];
    } catch (error) {
        console.error("getOrders error for email:", email, error);
        throw error;
    }
};
