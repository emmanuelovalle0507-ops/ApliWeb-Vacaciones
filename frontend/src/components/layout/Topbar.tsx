"use client";

import React from "react";
import { Menu, Bell } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { ROLE_LABELS } from "@/types";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuth();

  const initials = user?.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2) ?? "";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={22} />
        </button>
        <div className="hidden lg:block">
          <h2 className="text-sm font-medium text-gray-500">
            Bienvenido, <span className="text-gray-900 font-semibold">{user?.fullName}</span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{user?.fullName}</p>
            <p className="text-xs text-gray-400">{user ? ROLE_LABELS[user.role] : ""} · {user?.area.name}</p>
          </div>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-seekop-500 text-white text-sm font-bold">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
