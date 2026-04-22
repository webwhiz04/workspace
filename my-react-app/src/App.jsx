import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Nav from "./components/nav.jsx";
import Login from "./components/login.jsx";
import Otp from "./components/otp.jsx";
import AllPage from "./components/all.jsx";
import CafePage from "./components/cafepage.jsx";
import HomePage from "./components/homepage.jsx";
import ToysPage from "./components/toyspage.jsx";
import FreshPage from "./components/freshpage.jsx";
import ElectronicsPage from "./components/electronicspage.jsx";
import MobilePage from "./components/mobilepage.jsx";
import BeautyPage from "./components/beautypage.jsx";
import FashionPage from "./components/fashionpage.jsx";
import CartPage from "./components/cart.jsx";
import OrderPage from "./components/orderpage.jsx";
import PaymentPage from "./components/paymentpage.jsx";
import PlacedOrderPage from "./components/placedorderpage.jsx";
import MyOrdersPage from "./components/myorderspage.jsx";
import ProductDetailPage from "./components/productdetail.jsx";
import { isUserLoggedIn } from "./components/authStorage.js";

function RequireAuth({ children }) {
  const location = useLocation();

  if (!isUserLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function App() {
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    let timerId;

    const onCartItemAdded = (event) => {
      const customMessage = event?.detail?.message;
      const productName = event?.detail?.name || "Item";
      setToastMessage(customMessage || `${productName} added to cart`);

      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        setToastMessage("");
      }, 1800);
    };

    window.addEventListener("cart:item-added", onCartItemAdded);

    return () => {
      window.removeEventListener("cart:item-added", onCartItemAdded);
      window.clearTimeout(timerId);
    };
  }, []);

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<AllPage />} />
        <Route path="/all" element={<AllPage />} />
        <Route path="/cafe" element={<CafePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/toys" element={<ToysPage />} />
        <Route path="/fresh" element={<FreshPage />} />
        <Route path="/electronics" element={<ElectronicsPage />} />
        <Route path="/mobile" element={<MobilePage />} />
        <Route path="/beauty" element={<BeautyPage />} />
        <Route path="/fashion" element={<FashionPage />} />
        <Route
          path="/cart"
          element={
            <RequireAuth>
              <CartPage />
            </RequireAuth>
          }
        />
        <Route
          path="/order"
          element={
            <RequireAuth>
              <OrderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/payment"
          element={
            <RequireAuth>
              <PaymentPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my-orders"
          element={
            <RequireAuth>
              <MyOrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/order-success"
          element={
            <RequireAuth>
              <PlacedOrderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/placed-order"
          element={
            <RequireAuth>
              <PlacedOrderPage />
            </RequireAuth>
          }
        />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/otp" element={<Otp />} />
        <Route path="*" element={<Navigate to="/all" replace />} />
      </Routes>
      <div className={`cart-toast ${toastMessage ? "show" : ""}`} aria-live="polite" aria-atomic="true">
        {toastMessage}
      </div>
    </>
  );
}

export default App;