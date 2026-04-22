import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css'
import App from './App.jsx'
import Admin from "./components/admin.jsx";
import AdminDashboard from "./components/admindashboard.jsx";
import AddProduct from "./components/addproduct.jsx";
import ViewProduct from "./components/viewproduct.jsx";
import AdminUserOrders from "./components/adminuserorders.jsx";

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <Routes>
            <Route path="/*" element={<App />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admindashboard" element={<AdminDashboard />} />
            <Route path="/admindashboard/addproduct" element={<AddProduct />} />
            <Route path="/admindashboard/viewproduct" element={<ViewProduct />} />
            <Route path="/admindashboard/user" element={<AdminUserOrders />} />
        </Routes>
    </BrowserRouter>
);
