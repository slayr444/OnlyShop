import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Modal from "./Modal";   
import Button from "./Button";
import { Field, Input } from "./Field";
import "./Layout.css";

const NAV_ITEMS = [
    { to: "/products", label: "Товары", icon: "◧" },
    { to: "/orders", label: "Заказы", icon: "▤" },
    { to: "/categories", label: "Категории", icon: "◫" },
    { to: "/presale-locations", label: "Точки предзаказа", icon: "◎" },
];
const ADMIN_ONLY_ITEMS = [{ to: "/staff", label: "Сотрудники", icon: "◍" }];

export default function Layout() {
    const { staff, logout, isAdmin } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [form, setForm] = useState({ brandName: "", accentColor: "" });
    const [saving, setSaving] = useState(false);

    async function openSettings() {
        setIsSettingsOpen(true);
        try {
            const res = await fetch("/api/admin/settings", {
                headers: { Authorization: `Bearer ${localStorage.getItem("onlyshop_token")}` }
            });
            const data = await res.json();
            setForm({ brandName: data.brandName, accentColor: data.accentColor });
        } catch (e) { console.error(e); }
    }

    async function saveSettings(e) {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch("/api/admin/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("onlyshop_token")}`
                },
                body: JSON.stringify(form)
            });
            setIsSettingsOpen(false);
            window.location.reload();      
        } catch (e) { alert("Ошибка сохранения"); } finally { setSaving(false); }
    }

    return (
        <div className="shell">
            <aside className="shell__sidebar">
                <div className="shell__brand">
                    <span className="shell__brand-mark">OS</span>
                    <span className="shell__brand-name">OnlyShop</span>
                </div>

                <nav className="shell__nav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink key={item.to} to={item.to} className={({ isActive }) => `shell__nav-item${isActive ? " shell__nav-item--active" : ""}`}>
                            <span className="shell__nav-icon">{item.icon}</span>{item.label}
                        </NavLink>
                    ))}
                    {isAdmin && (
                        <>
                            <div className="shell__nav-divider" />
                            {ADMIN_ONLY_ITEMS.map((item) => (
                                <NavLink key={item.to} to={item.to} className={({ isActive }) => `shell__nav-item${isActive ? " shell__nav-item--active" : ""}`}>
                                    <span className="shell__nav-icon">{item.icon}</span>{item.label}
                                </NavLink>
                            ))}
                        </>
                    )}
                    {    }
                    <button className="shell__nav-item" onClick={openSettings} style={{ color: 'var(--primary-bright)' }}>
                        <span className="shell__nav-icon">⚙</span> Настройки бренда
                    </button>
                </nav>

                <div className="shell__account glass">
                    <div className="shell__account-info">
                        <span className="shell__account-name">{staff?.name}</span>
                        <span className="shell__account-role">{staff?.role === "Admin" ? "Администратор" : "Менеджер"}</span>
                    </div>
                    <button className="shell__logout" onClick={logout} aria-label="Выйти" title="Выйти">⏻</button>
                </div>
            </aside>

            <main className="shell__content">
                <Outlet />
            </main>

            {   }
            {isSettingsOpen && (
                <Modal title="Настройки брендинга" onClose={() => setIsSettingsOpen(false)}>
                    <form className="pform" onSubmit={saveSettings}>
                        <Field label="Название магазина (в шапке)" required>
                            <Input value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} required />
                        </Field>
                        <Field label="Акцентный цвет" required>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input type="color" value={form.accentColor} onChange={e => setForm({ ...form, accentColor: e.target.value })} style={{ width: '50px', height: '40px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }} />
                                <Input value={form.accentColor} onChange={e => setForm({ ...form, accentColor: e.target.value })} required />
                            </div>
                        </Field>
                        <div className="pform__actions">
                            <Button variant="ghost" type="button" onClick={() => setIsSettingsOpen(false)}>Отмена</Button>
                            <Button variant="solid" type="submit" loading={saving}>Сохранить</Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}