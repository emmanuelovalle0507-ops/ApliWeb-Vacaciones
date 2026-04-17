"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  User as UserIcon,
  Palmtree,
  Users,
  ShieldCheck,
  FileBarChart,
  Activity,
  Settings2,
  Compass,
  CircleDollarSign,
  Megaphone,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import { ROLE_LABELS } from "@/types";

type Result = {
  id: string;
  kind: "user" | "request" | "team" | "nav";
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
};

export default function CommandPalette() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === "ADMIN" || user?.role === "HR";

  // Global hotkey
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Data fetched only for admins (users/teams list). Employees get nav-only.
  const usersQ = useQuery({
    queryKey: ["cmdk.users"],
    queryFn: async () => (await api.admin.users.list({})).items,
    enabled: open && isAdmin,
    staleTime: 60000,
  });

  const teamsQ = useQuery({
    queryKey: ["cmdk.teams"],
    queryFn: () => api.admin.teams.list(),
    enabled: open && isAdmin,
    staleTime: 120000,
  });

  // Navigation shortcuts — always available
  const navShortcuts: Result[] = useMemo(() => {
    const role = user?.role;
    const close = () => setOpen(false);
    const go = (href: string) => () => { router.push(href); close(); };

    const items: Result[] = [
      { id: "nav-profile", kind: "nav", title: "Mi Perfil", icon: UserIcon, action: go("/profile") },
    ];

    if (role === "EMPLOYEE" || role === "MANAGER") {
      items.unshift({ id: "nav-emp-dash", kind: "nav", title: "Mi Dashboard", icon: Compass, action: go("/employee/dashboard") });
    }
    if (role === "MANAGER") {
      items.push({ id: "nav-mgr-dash", kind: "nav", title: "Dashboard Manager", icon: Compass, action: go("/manager/dashboard") });
      items.push({ id: "nav-mgr-exp", kind: "nav", title: "Gastos / Viáticos", icon: CircleDollarSign, action: go("/manager/expenses") });
    }
    if (role === "ADMIN") {
      items.unshift({ id: "nav-admin", kind: "nav", title: "Panel Admin", icon: ShieldCheck, action: go("/admin/dashboard") });
      items.push({ id: "nav-admin-users", kind: "nav", title: "Gestión de usuarios", icon: Users, action: go("/admin/dashboard?tab=users") });
      items.push({ id: "nav-admin-req", kind: "nav", title: "Solicitudes globales", icon: Palmtree, action: go("/admin/dashboard?tab=requests") });
      items.push({ id: "nav-admin-bal", kind: "nav", title: "Balances", icon: FileBarChart, action: go("/admin/dashboard?tab=balances") });
      items.push({ id: "nav-admin-audit", kind: "nav", title: "Auditoría", icon: ShieldCheck, action: go("/admin/dashboard?tab=audit") });
      items.push({ id: "nav-admin-health", kind: "nav", title: "Estado del sistema", icon: Activity, action: go("/admin/health") });
      items.push({ id: "nav-admin-settings", kind: "nav", title: "Configuración", icon: Settings2, action: go("/admin/settings") });
      items.push({ id: "nav-admin-ann", kind: "nav", title: "Anuncios", icon: Megaphone, action: go("/admin/dashboard?tab=announcements") });
    }
    if (role === "HR") {
      items.unshift({ id: "nav-hr", kind: "nav", title: "Panel RRHH", icon: Users, action: go("/hr/dashboard") });
    }
    if (role === "FINANCE") {
      items.unshift({ id: "nav-fin", kind: "nav", title: "Revisión de Gastos", icon: FileBarChart, action: go("/finance/dashboard") });
    }

    return items;
  }, [user?.role, router]);

  // Filter results by query
  const results: Result[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];

    // Nav always shown; when query empty, only nav items
    for (const item of navShortcuts) {
      if (!q || item.title.toLowerCase().includes(q)) out.push(item);
    }

    if (q && isAdmin) {
      // Users
      for (const u of usersQ.data ?? []) {
        if (
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.position ?? "").toLowerCase().includes(q)
        ) {
          out.push({
            id: `user-${u.id}`,
            kind: "user",
            title: u.fullName,
            subtitle: `${ROLE_LABELS[u.role]} · ${u.email}`,
            icon: UserIcon,
            action: () => {
              router.push(`/admin/dashboard?tab=users`);
              setOpen(false);
            },
          });
        }
      }

      // Teams
      for (const t of teamsQ.data ?? []) {
        if (t.name.toLowerCase().includes(q)) {
          out.push({
            id: `team-${t.id}`,
            kind: "team",
            title: t.name,
            subtitle: "Equipo",
            icon: Users,
            action: () => {
              router.push(`/admin/dashboard?tab=users`);
              setOpen(false);
            },
          });
        }
      }
    }

    return out.slice(0, 30);
  }, [query, navShortcuts, usersQ.data, teamsQ.data, isAdmin, router]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  // Keyboard navigation within palette
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[activeIndex]?.action();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar usuarios, equipos o ir a…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-400"
          />
          <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              Sin resultados
            </div>
          ) : (
            results.map((r, idx) => {
              const Icon = r.icon;
              const active = idx === activeIndex;
              return (
                <button
                  key={r.id}
                  onClick={r.action}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    active ? "bg-seekop-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                    active ? "bg-seekop-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                    {r.subtitle && (
                      <p className="text-xs text-slate-500 truncate">{r.subtitle}</p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                    {r.kind}
                  </span>
                  {active && <ArrowRight size={14} className="text-seekop-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-white border border-slate-200 px-1 rounded">↑↓</kbd> navegar
            </span>
            <span>
              <kbd className="font-mono bg-white border border-slate-200 px-1 rounded">⏎</kbd> abrir
            </span>
          </div>
          <span>
            <kbd className="font-mono bg-white border border-slate-200 px-1 rounded">⌘ K</kbd> alternar
          </span>
        </div>
      </div>
    </div>
  );
}
