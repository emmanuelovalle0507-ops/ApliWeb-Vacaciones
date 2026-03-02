"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Shield,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import type { UserRole, NavItem } from "@/types";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  Shield,
};

const NAV_CONFIG: Record<UserRole, NavItem[]> = {
  EMPLOYEE: [
    { label: "Mi Dashboard", href: "/employee/dashboard", icon: "LayoutDashboard" },
  ],
  MANAGER: [
    { label: "Dashboard Manager", href: "/manager/dashboard", icon: "LayoutDashboard" },
    { label: "Mis Vacaciones", href: "/employee/dashboard", icon: "CalendarDays" },
  ],
  ADMIN: [
    { label: "Panel Admin", href: "/admin/dashboard", icon: "LayoutDashboard" },
  ],
  HR: [
    { label: "Panel RRHH", href: "/hr/dashboard", icon: "LayoutDashboard" },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Manager",
  EMPLOYEE: "Empleado",
  HR: "RRHH",
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const navItems = NAV_CONFIG[user.role] ?? [];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-700/50">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20">
              <span className="font-black text-white text-sm">S</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-white tracking-widest">SEEKOP</span>
              <span className="text-[9px] font-semibold text-seekop-400 -mt-0.5 tracking-[0.2em] uppercase">Consulting</span>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-seekop-500/15 text-seekop-400 border-l-2 border-seekop-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {(() => { const Icon = ICON_MAP[item.icon] ?? LayoutDashboard; return <Icon size={20} />; })()}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-slate-700/50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-seekop-500/20 text-seekop-400 text-sm font-bold shrink-0">
              {user.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.fullName}
              </p>
              <p className="text-xs text-slate-400 truncate">{ROLE_LABEL[user.role] ?? user.role} · {user.area.name}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors w-full px-1"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
