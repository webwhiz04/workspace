import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./addproduct.css";
import getImageUrl from "./imageUrl.js";

const API_URL = "http://localhost:5000/api/products";

const callApi = (path = "", options = {}) => fetch(`${API_URL}${path}`, options);

const options = [
    { value: 'cafe', label: 'Cafe' },
    { value: 'home', label: 'Home' },
    { value: 'toys', label: 'Toys' },
    { value: 'fresh', label: 'Fresh' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'beauty', label: 'Beauty' },
    { value: 'fashion', label: 'Fashion' },
];

function AddProduct({
    isEdit = false,
    editId = "",
    initialProduct = null,
    onSuccess,
    onCancel,
    embedded = false,
}) {
    const [productName, setProductName] = useState("");
    const [price, setPrice] = useState("");
    const [categories, setCategories] = useState([]);
    const [quantity, setQuantity] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [description, setDescription] = useState("");
    const [currentImage, setCurrentImage] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const editMode = isEdit && Boolean(editId);

    useEffect(() => {
        if (editMode && initialProduct?._id && initialProduct._id === editId) {
            setProductName(initialProduct.name || "");
            setPrice(initialProduct.price ?? "");
            setQuantity(initialProduct.quantity ?? "");
            setDescription(initialProduct.description || "");
            setCurrentImage(initialProduct.image || "");
            setCategories(initialProduct.categories || []);
            setMessage("");
            setLoading(false);
            return;
        }

        const fetchProductById = async () => {
            if (!editMode) return;
            try {
                setLoading(true);
                setMessage("");
                const response = await callApi(`/${editId}`);
                const data = await response.json();
                if (!response.ok) {
                    setMessage(data?.message || "Failed to load product");
                    return;
                }
                const product = data?.product;
                setProductName(product.name || "");
                setPrice(product.price ?? "");
                setQuantity(product.quantity ?? "");
                setDescription(product.description || "");
                setCurrentImage(product.image || "");
                setCategories(product.categories || []);
            } catch {
                setMessage("Could not load product details");
            } finally {
                setLoading(false);
            }
        };

        fetchProductById();
    }, [editMode, editId, initialProduct]);

    const handleClose = () => {
        if (editMode && onCancel) {
            onCancel();
            return;
        }

        if (editMode) {
            navigate("/admindashboard/viewproduct");
        } else {
            navigate("/admindashboard");
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage("");

        if (!productName.trim() || !price || !quantity) {
            setMessage("Please fill product name, price, and quantity");
            return;
        }

        if (!Array.isArray(categories) || categories.length === 0) {
            setMessage("Please select at least one category");
            return;
        }

        if (Number(price) <= 0 || Number(quantity) < 0) {
            setMessage("Price must be greater than 0");
            return;
        }

        try {
            setSaving(true);

            let response;

            if (editMode) {
                const formData = new FormData();
                formData.append("name", productName.trim());
                formData.append("price", price);
                formData.append("quantity", quantity);
                formData.append("description", description.trim());
                formData.append("categories", JSON.stringify(categories));

                if (imageFile) {
                    formData.append("image", imageFile);
                }

                response = await callApi(`/${editId}`, {
                    method: "PUT",
                    body: formData,
                });
            } else {
                const formData = new FormData();
                formData.append("name", productName.trim());
                formData.append("price", price);
                formData.append("quantity", quantity);
                formData.append("description", description.trim());
                formData.append("categories", JSON.stringify(categories));
                if (imageFile) {
                    formData.append("image", imageFile);
                }

                response = await callApi("", {
                    method: "POST",
                    body: formData,
                });
            }

            const data = await response.json();

            if (!response.ok) {
                setMessage(data?.message || "Failed to save product");
                return;
            }

            if (editMode) {
                setMessage("Product updated successfully");
                onSuccess?.(data.product);
                return;
            }

            setMessage("Product saved successfully");
            setProductName("");
            setPrice("");
            setQuantity("");
            setImageFile(null);
            setDescription("");
            setCategories([]);
            onSuccess?.(data.product);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error) {
            setMessage("Could not connect to server");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`addproduct${embedded ? " embedded" : ""}`}>
            <form className="form" onSubmit={handleSubmit} autoComplete="off">
                <h2>{editMode ? "Edit Product" : "Add Product"}</h2>
                {loading && <p className="form-message">Loading product...</p>}

                <label htmlFor="productName">Product Name</label>
                <input
                    id="productName"
                    type="text"
                    autoComplete="off"
                    placeholder="Enter product name"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                />

                <label htmlFor="price">Price</label>
                <input
                    id="price"
                    type="number"
                    min="0"
                    step="1"
                    autoComplete="off"
                    placeholder="Enter product price"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                />
                <label htmlFor="categories">Category</label>
                <select
                    id="categories"
                    value={categories[0] || ""}
                    onChange={(event) => {
                        const selectedValue = event.target.value;
                        setCategories(selectedValue ? [selectedValue] : []);
                    }}
                >
                   <option  hidden value="">Select category</option>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <label htmlFor="quantity">Quantity</label>
                <input
                    id="quantity"
                    type="text"
                    autoComplete="off"
                    placeholder="Enter quantity (example: 1kg, 2 packs)"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                />

                <label htmlFor="image">Product Image</label>
                <input
                    id="image"
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                />
                {editMode && currentImage && !imageFile && (
                    <img src={getImageUrl(currentImage)} alt="Current product" className="img" />
                )}
                {editMode && <p className="image-hint">Choose a new image only if you want to replace the old one.</p>}

                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    autoComplete="off"
                    placeholder="Enter product description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows="4"
                />

                {message && <p className="form-message">{message}</p>}

                <div className="formadd">
                    <button type="submit" className="save" disabled={saving}>
                        {saving ? "Saving..." : editMode ? "Update Product" : "Save Product"}
                    </button>
                    <button type="button" className="back" onClick={handleClose}>
                        {editMode ? "Cancel" : "Back"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AddProduct;
