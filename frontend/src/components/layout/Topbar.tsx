"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, UserCircle, Lock, LogOut, ChevronDown, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { ROLE_LABELS } from "@/types";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import api from "@/api/client";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user?.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2) ?? "";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  const menuItems = [
    {
      label: "Mi Perfil",
      icon: UserCircle,
      onClick: () => { router.push("/profile"); setDropdownOpen(false); },
    },
    {
      label: "Cambiar contraseña",
      icon: Lock,
      onClick: () => { router.push("/profile"); setDropdownOpen(false); },
    },
    {
      label: "Cerrar sesión",
      icon: LogOut,
      onClick: () => { logout(); setDropdownOpen(false); },
      danger: true,
    },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-sm border-b border-slate-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={22} />
        </button>
        <div className="hidden lg:block">
          <h2 className="text-sm font-medium text-slate-400">
            Bienvenido, <span className="text-slate-800 font-semibold">{user?.fullName}</span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <AnnouncementBadge />
        <NotificationPanel />

        {/* User dropdown — desktop (with text) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="hidden sm:flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            title="Cuenta"
          >
            <div className="flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">
                {user?.fullName}
              </span>
              <span className="text-xs text-slate-500 truncate max-w-[160px]">
                {user ? ROLE_LABELS[user.role] : ""} · {user?.area.name}
              </span>
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-seekop-500 text-white text-sm font-bold shadow-sm ring-2 ring-seekop-100/70">
              {initials}
            </div>
            <ChevronDown
              size={16}
              className={`text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Mobile avatar — opens same dropdown */}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full bg-seekop-500 text-white text-sm font-bold shadow-sm ring-2 ring-seekop-100/70 cursor-pointer"
            title="Cuenta"
          >
            {initials}
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-[fadeIn_0.15s_ease]">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.fullName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                {menuItems.map((item) => (
                  <React.Fragment key={item.label}>
                    {item.danger && <div className="my-1.5 border-t border-gray-100" />}
                    <button
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        item.danger
                          ? "text-red-600 hover:bg-red-50"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <item.icon size={16} className={item.danger ? "text-red-400" : "text-gray-400"} />
                      {item.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function AnnouncementBadge() {
  const { user } = useAuth();
  const { data: count = 0 } = useQuery({
    queryKey: ["announcements.unreadCount", user?.id],
    queryFn: () => api.announcements.getUnreadCount(),
    enabled: !!user,
    refetchInterval: 30000,
  });

  return (
    <button
      className="relative p-2 text-gray-500 hover:text-seekop-600 hover:bg-seekop-50 rounded-lg transition-colors"
      title="Anuncios del equipo"
    >
      <Megaphone size={20} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
