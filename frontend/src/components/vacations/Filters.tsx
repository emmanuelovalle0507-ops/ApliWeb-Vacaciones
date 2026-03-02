"use client";

import React from "react";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { REQUEST_STATUSES, STATUS_LABELS, USER_ROLES, ROLE_LABELS } from "@/types";

interface AreaOption {
  id: string;
  name: string;
}

interface RequestFiltersBarProps {
  status: string;
  areaId: string;
  startDate: string;
  endDate: string;
  areas?: AreaOption[];
  onStatusChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
}

export function RequestFiltersBar({
  status,
  areaId,
  startDate,
  endDate,
  areas = [],
  onStatusChange,
  onAreaChange,
  onStartDateChange,
  onEndDateChange,
}: RequestFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <Select
        label="Estado"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        placeholder="Todos"
        options={REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <Select
        label="Área"
        value={areaId}
        onChange={(e) => onAreaChange(e.target.value)}
        placeholder="Todas"
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
      />
      <Input
        type="date"
        label="Desde"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
      />
      <Input
        type="date"
        label="Hasta"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
      />
    </div>
  );
}

interface UserFiltersBarProps {
  role: string;
  areaId: string;
  search: string;
  areas?: AreaOption[];
  onRoleChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

export function UserFiltersBar({
  role,
  areaId,
  search,
  areas = [],
  onRoleChange,
  onAreaChange,
  onSearchChange,
}: UserFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <Select
        label="Rol"
        value={role}
        onChange={(e) => onRoleChange(e.target.value)}
        placeholder="Todos"
        options={USER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
      />
      <Select
        label="Área"
        value={areaId}
        onChange={(e) => onAreaChange(e.target.value)}
        placeholder="Todas"
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
      />
      <Input
        label="Buscar"
        placeholder="Nombre o email..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}
