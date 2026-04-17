"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Compass,
  FileBarChart,
  Palmtree,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import type { UserRole } from "@/types";

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  Compass,
  Palmtree,
  CircleDollarSign,
  Wallet,
  FileBarChart,
  Shield,
  ShieldCheck,
  Users,
  User,
  Sparkles,
  Settings2,
};

type BadgeKind = "pendingApprovals" | "financeReview" | "adminPending";

interface NavItemWithBadge {
  label: string;
  href: string;
  icon: string;
  badge?: BadgeKind;
}

const NAV_CONFIG: Record<UserRole, NavItemWithBadge[]> = {
  EMPLOYEE: [
    { label: "Mi Dashboard", href: "/employee/dashboard", icon: "Compass" },
    { label: "Mi Perfil", href: "/profile", icon: "User" },
  ],
  MANAGER: [
    { label: "Dashboard Manager", href: "/manager/dashboard", icon: "Compass", badge: "pendingApprovals" },
    { label: "Gastos / Viáticos", href: "/manager/expenses", icon: "Wallet" },
    { label: "Mis Vacaciones", href: "/employee/dashboard", icon: "Palmtree" },
    { label: "Mi Perfil", href: "/profile", icon: "User" },
  ],
  ADMIN: [
    { label: "Panel Admin", href: "/admin/dashboard", icon: "ShieldCheck" },
    { label: "Usuarios", href: "/admin/dashboard?tab=users", icon: "Users" },
    { label: "Solicitudes", href: "/admin/dashboard?tab=requests", icon: "Palmtree", badge: "adminPending" },
    { label: "Balances", href: "/admin/dashboard?tab=balances", icon: "FileBarChart" },
    { label: "Auditoría", href: "/admin/dashboard?tab=audit", icon: "Shield" },
    { label: "Control de Gastos", href: "/admin/expenses", icon: "CircleDollarSign" },
    { label: "Estado del sistema", href: "/admin/health", icon: "Activity" },
    { label: "Configuración", href: "/admin/settings", icon: "Settings2" },
    { label: "Mi Perfil", href: "/profile", icon: "User" },
  ],
  HR: [
    { label: "Panel RRHH", href: "/hr/dashboard", icon: "Users" },
    { label: "Mi Perfil", href: "/profile", icon: "User" },
  ],
  FINANCE: [
    { label: "Revisión de Gastos", href: "/finance/dashboard", icon: "FileBarChart", badge: "financeReview" },
    { label: "Mi Perfil", href: "/profile", icon: "User" },
  ],
};

function usePendingApprovalsCount(enabled: boolean, userId?: string) {
  const { data } = useQuery({
    queryKey: ["sidebar.pendingApprovals", userId],
    queryFn: async () => {
      const res = await api.approvals.listPending(userId ?? "", { page: 1, pageSize: 1 });
      return res.pagination.total;
    },
    enabled,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  return data ?? 0;
}

function useFinanceReviewCount(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["sidebar.financeReview"],
    queryFn: async () => {
      const res = await api.finance.listReports({ status: "SUBMITTED", page: 1, pageSize: 1 });
      return res.pagination.total;
    },
    enabled,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  return data ?? 0;
}

function useAdminPendingCount(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["sidebar.adminPending"],
    queryFn: async () => {
      const res = await api.admin.requests.list({ status: "PENDING" }, { page: 1, pageSize: 1 });
      return res.pagination.total;
    },
    enabled,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  return data ?? 0;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const pendingApprovals = usePendingApprovalsCount(user?.role === "MANAGER", user?.id);
  const financeReview = useFinanceReviewCount(user?.role === "FINANCE");
  const adminPending = useAdminPendingCount(user?.role === "ADMIN");

  if (!user) return null;

  const navItems = NAV_CONFIG[user.role] ?? [];

  const getBadgeCount = (kind?: BadgeKind): number => {
    if (kind === "pendingApprovals") return pendingApprovals;
    if (kind === "financeReview") return financeReview;
    if (kind === "adminPending") return adminPending;
    return 0;
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`relative shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? "lg:w-[72px] w-64" : "w-64"
        }`}
      >
        {/* Floating collapse toggle — outside aside so overflow-hidden won't clip it */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute top-1/2 -right-3 z-[60] -translate-y-1/2 items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-slate-300 hover:bg-seekop-500 hover:text-white shadow-md ring-1 ring-slate-600 hover:ring-seekop-400 transition-all duration-200 hover:scale-110"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-slate-900 flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-full lg:z-auto shrink-0 overflow-hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[72px] w-64" : "w-64"}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-3">
          <Link href="/" className={`flex items-center gap-3 min-w-0 group ${collapsed ? "justify-center w-full" : ""}`}>
            <div className="flex items-center justify-center h-10 px-2 rounded-xl bg-white/95 ring-1 ring-white/10 shadow-sm overflow-hidden shrink-0 transition-transform duration-200 group-hover:scale-[1.02]">
              <Image
                src="/branding/seekop-logo.png"
                alt="Seekop Consulting"
                width={108}
                height={30}
                className={`object-contain transition-all duration-300 ${collapsed ? "w-6 h-6" : "w-auto h-6"}`}
                priority
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-semibold text-white/90 tracking-[0.22em] uppercase truncate">Seekop</span>
                <span className="text-[10px] font-medium text-slate-400 truncate">Vacation Control</span>
              </div>
            )}
          </Link>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className={`flex-1 px-2 py-4 space-y-1 ${collapsed ? "overflow-hidden" : "overflow-y-auto"}`}>
          {navItems.map((item) => {
            const [itemPath, itemQuery] = item.href.split("?");
            const itemTab = itemQuery ? new URLSearchParams(itemQuery).get("tab") : null;
            const isActive = itemTab
              ? pathname === itemPath && currentTab === itemTab
              : pathname === itemPath && !currentTab;
            const Icon = ICON_MAP[item.icon] ?? Compass;
            const badgeCount = getBadgeCount(item.badge);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-seekop-500/15 text-white shadow-[0_0_12px_rgba(154,178,54,0.1)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <div className="relative shrink-0">
                  <Icon size={19} className={`transition-colors ${isActive ? "text-[#9ab236]" : ""}`} strokeWidth={isActive ? 2.2 : 1.8} />
                  {collapsed && badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold bg-red-500 text-white rounded-full ring-2 ring-slate-900">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold bg-red-500 text-white rounded-full shrink-0">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </>
                )}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 shadow-lg ring-1 ring-slate-700 z-[100] pointer-events-none">
                    {item.label}
                    {badgeCount > 0 && <span className="ml-1.5 text-red-400">({badgeCount})</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — brand mark + version */}
        <div className={`px-3 py-3 border-t border-white/5 ${collapsed ? "flex justify-center" : ""}`}>
          {collapsed ? (
            <div className="w-2 h-2 rounded-full bg-[#9ab236]/60" title="Seekop · Vacation Control" />
          ) : (
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span className="tracking-wider uppercase">Seekop · {new Date().getFullYear()}</span>
              <span className="font-mono">v1.0</span>
            </div>
          )}
        </div>
      </aside>
      </div>
    </>
  );
}
