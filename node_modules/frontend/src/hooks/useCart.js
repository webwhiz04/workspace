import { addToCart } from "../utils/cartStorage.js";
import { getLoggedInEmail, isUserLoggedIn } from "../utils/authStorage.js";

const normalizeProductForCart = (product) => {
    if (!product || typeof product !== "object") {
        return null;
    }

    const productId = product._id || product.id || product.productId;

    if (!productId) {
        return null;
    }

    return {
        ...product,
        _id: String(productId),
        name: String(product.name || "").trim(),
        image: String(product.image || "").trim(),
        price: Number(product.price || 0),
    };
};

function useCart() {
    const handleAdd = async (product) => {
        const normalizedProduct = normalizeProductForCart(product);

        if (!normalizedProduct) {
            window.dispatchEvent(
                new CustomEvent("cart:item-added", {
                    detail: {
                        message: "Unable to add this item to cart",
                    },
                }),
            );
            return;
        }

        if (!isUserLoggedIn()) {
            window.dispatchEvent(
                new CustomEvent("cart:item-added", {
                    detail: {
                        message: "Login first to add items to cart",
                    },
                }),
            );
            return;
        }

        const email = getLoggedInEmail();

        if (!email) {
            window.dispatchEvent(
                new CustomEvent("cart:item-added", {
                    detail: {
                        message: "Login first to add items to cart",
                    },
                }),
            );
            return;
        }

        try {
            await addToCart(email, normalizedProduct);
        } catch (error) {
            window.dispatchEvent(
                new CustomEvent("cart:item-added", {
                    detail: {
                        message: error.message || "Unable to add item to cart",
                    },
                }),
            );
            return;
        }

        window.dispatchEvent(
            new CustomEvent("cart:item-added", {
                detail: {
                    name: normalizedProduct.name || "Item",
                },
            }),
        );
    };

    return {
        handleAdd,
    };
}

export default useCart;