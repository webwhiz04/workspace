import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./cart.css";
import {
    getCartItems,
    updateCartQuantity,
    removeFromCart,
    getOrders,
    getSavedShippingAddress,
} from "./cartStorage.js";
import { getLoggedInEmail, isUserLoggedIn } from "./authStorage.js";
import getImageUrl from "./imageUrl.js";

const HANDLING_FEE = 30;
const DELIVERY_FEE = 10;

function CartPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = isUserLoggedIn();
    const email = getLoggedInEmail();
    const [items, setItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSavedAddress, setHasSavedAddress] = useState(false);

    useEffect(() => {
        if (!loggedIn) {
            navigate("/login", { replace: true, state: { from: location } });
        }
    }, [loggedIn, navigate, location]);



    const loadCartData = async () => {
        if (!loggedIn || !email) {
            setItems([]);
            setOrders([]);
            setHasSavedAddress(false);
            return;
        }

        const [cartResult, orderResult, addressResult] = await Promise.allSettled([
            getCartItems(email),
            getOrders(email),
            getSavedShippingAddress(email),
        ]);

        if (cartResult.status === "fulfilled") {
            setItems(Array.isArray(cartResult.value) ? cartResult.value : []);
        } else {
            console.error("Fetch Cart Items Error:", cartResult.reason);
            setItems([]);
        }

        if (orderResult.status === "fulfilled") {
            setOrders(Array.isArray(orderResult.value) ? orderResult.value : []);
        } else {
            console.error("Fetch Orders Error:", orderResult.reason);
            setOrders([]);
        }

        if (addressResult.status === "fulfilled" && addressResult.value) {
            setHasSavedAddress(true);
        } else {
            if (addressResult.status === "rejected") {
                console.error("Fetch Saved Address Error:", addressResult.reason);
            }
            setHasSavedAddress(false);
        }
    };

    useEffect(() => {
        const fetchCart = async () => {
            if (!loggedIn || !email) {
                setItems([]);
                return;
            }

            setIsLoading(true);
            try {
                await loadCartData();
            } catch (error) {
                console.error("Fetch Cart Error:", error);
                setItems([]);
                setOrders([]);
                setHasSavedAddress(false);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCart();
    }, [loggedIn, email]);

    const handleIncrease = async (productId, currentQty) => {
        if (!email) return;
        try {
            const nextItems = await updateCartQuantity(email, productId, currentQty + 1);
            setItems(nextItems);
        } catch (error) {
            console.error("Increase Quantity Error:", error);
        }
    };

    const handleDecrease = async (productId, currentQty) => {
        if (!email) return;
        const nextQty = currentQty - 1;
        if (nextQty <= 0) {
            try {
                const nextItems = await removeFromCart(email, productId);
                setItems(nextItems);
            } catch (error) {
                console.error("Remove Cart Item Error:", error);
            }
            return;
        }

        try {
            const nextItems = await updateCartQuantity(email, productId, nextQty);
            setItems(nextItems);
        } catch (error) {
            console.error("Decrease Quantity Error:", error);
        }
    };

    const handleRemove = async (productId) => {
        if (!email) return; 
        try {
            const nextItems = await removeFromCart(email, productId);
            setItems(nextItems);
        } catch (error) {
            console.error("Remove Cart Item Error:", error);
        }
    };

    const itemTotal = useMemo(() => {
        return items.reduce((total, item) => total + Number(item.price || 0) * Number(item.cartQuantity || 0), 0);
    }, [items]);

    const handlingFee = items.length > 0 ? HANDLING_FEE : 0;
    const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
    const totalToPay = itemTotal + handlingFee + deliveryFee;

    return (
        <section className="cart">
            <button type="button" className="cartclose" onClick={() => navigate(-1)} aria-label="Close cart" />
            <aside className="cartside" aria-label="Cart drawer">
                <div className="cartlabel">
                    <h1 className="carttitle">Cart</h1>
                    <button type="button" className="cartclosebtn" onClick={() => navigate(-1)}>
                        Close
                    </button>
                </div>

                <div className="cartlist">
                    {!loggedIn ? (
                        <div className="cartlogin">
                            <h2>Login first</h2>
                            <p>Please login to view your cart details.</p>
                            <button type="button" className="cartloginbtn" onClick={() => navigate("/login")}>Login</button>
                        </div>
                    ) : isLoading ? (
                        <p className="cartempty">Loading cart...</p>
                    ) : items.length === 0 ? (
                        <p className="cartempty">Your cart is empty.</p>
                    ) : (
                        items.map((item) => (
                            <article className="cartrow" key={item._id}>
                                <img
                                    className="cartimage"
                                    src={getImageUrl(item.image)}
                                    alt={item.name}
                                    onError={(event) => {
                                        event.currentTarget.src = "https://via.placeholder.com/80x80?text=No+Image";
                                    }}
                                />
                                <div className="cartcontent">
                                    <p className="cartname">{item.name}</p>
                                    <p className="cartprice">₹{Number(item.price || 0).toFixed(2)}</p>
                                </div>
                                <div className="cartqty">
                                    <button type="button" onClick={() => handleDecrease(item._id, item.cartQuantity)}>
                                        -
                                    </button>
                                    <span>{item.cartQuantity}</span>
                                    <button type="button" onClick={() => handleIncrease(item._id, item.cartQuantity)}>
                                        +
                                    </button>
                                </div>
                                <div>
                                    <button type="button" className="remove" onClick={() => handleRemove(item._id)}>
                                        Remove
                                    </button>
                                </div>
                            </article>
                        ))
                    )}
                </div>

                {loggedIn ? (
                    <>
                        <section className="billsummary">
                            <h3>Bill Summary</h3>
                            <div className="bill">
                                <span>Item Total</span>
                                <span>₹{itemTotal.toFixed(2)}</span>
                            </div>
                            <div className="bill">
                                <span>Handling Fee</span>
                                <span>₹{handlingFee.toFixed(2)}</span>
                            </div>
                            <div className="bill">
                                <span>Delivery Fee</span>
                                <span>₹{deliveryFee.toFixed(2)}</span>
                            </div>
                        </section>
                        <div className="total">
                            <span className="totalpay">Total: Rs ₹{totalToPay.toFixed(2)}</span>
                        </div>
                        {items.length > 0 && (
                            <button 
                                type="button" 
                                className="orderbtn" 
                                onClick={() => navigate("/order")}
                            >
                               Add address to proceed
                            </button>
                        )}
                    </>
                ) : null}
            </aside>
        </section>
    );
}

export default CartPage;
