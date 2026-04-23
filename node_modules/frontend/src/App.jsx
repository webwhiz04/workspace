import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Nav from "./components/nav.jsx";
import Login from "./pages/login.jsx";
import Otp from "./pages/otp.jsx";
import AllPage from "./pages/all.jsx";
import CafePage from "./pages/cafepage.jsx";
import HomePage from "./pages/homepage.jsx";
import ToysPage from "./pages/toyspage.jsx";
import FreshPage from "./pages/freshpage.jsx";
import ElectronicsPage from "./pages/electronicspage.jsx";
import MobilePage from "./pages/mobilepage.jsx";
import BeautyPage from "./pages/beautypage.jsx";
import FashionPage from "./pages/fashionpage.jsx";
import CartPage from "./pages/cart.jsx";
import OrderPage from "./pages/orderpage.jsx";
import PaymentPage from "./pages/paymentpage.jsx";
import PlacedOrderPage from "./pages/placedorderpage.jsx";
import MyOrdersPage from "./pages/myorderspage.jsx";
import ProductDetailPage from "./pages/productdetail.jsx";
import { isUserLoggedIn } from "./utils/authStorage.js";

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