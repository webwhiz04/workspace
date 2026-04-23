import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/categoryproducts.css";
import useCart from "../hooks/useCart.js";
import getImageUrl from "../utils/imageUrl.js";

import API_BASE_URL from "../services/api";

const BASE_URL = API_BASE_URL;
const API_URL = `${BASE_URL}/api/products?category=beauty`;

const getRatingLabel = (product) => {
   
    return "NA";
};

function BeautyPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { handleAdd } = useCart();
    const navigate = useNavigate();

    const openProduct = (id) => {
        if (!id) return;
        navigate(`/product/${id}`);
    };

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                const response = await fetch(API_URL);

                if (!response.ok) {
                    throw new Error("Unable to fetch products");
                }

                const data = await response.json();
                const list = Array.isArray(data.products) ? data.products : [];
                setProducts(list.filter((item) => Array.isArray(item.categories) && item.categories.includes("beauty")));
            } catch (error) {
                console.error("Error fetching beauty products:", error);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

 
    return (
        <div className="categorypage">
            <div className="product">
                {products.map((product) => (
                    <div
                        key={product._id}
                        className="productcard"
                        role="button"
                        tabIndex={0}
                        onClick={() => openProduct(product._id)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openProduct(product._id);
                            }
                        }}
                    >
                        <div className="productimages">
                            <img
                                className="productimage"
                                src={getImageUrl(product.image)}
                                alt={product.name}
                                onError={(event) => {
                                    event.currentTarget.src = "https://via.placeholder.com/300x220?text=No+Image";
                                }}
                            />
                            <button
                                className="add"
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleAdd(product);
                                }}
                            >
                                Add
                            </button>
                        </div>
                        <div className="productcontent">
                            <h2 className="productname">{product.name}</h2>
                            <p className="productdescription">
                                {product.description?.trim() || "No description available"}
                            </p>
                            <div className="productprice">
                                <p className="quantity">
                                    Qty: {product.quantity ? product.quantity : "NA"}
                                </p>
                                <p className="ratings">Rating: {getRatingLabel(product)}</p>
                            </div>
                            <button className="price" type="button">
                                ₹{Number(product.price || 0).toFixed(2)}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default BeautyPage;
