export const employeeModules = [
  { key: "overview", label: "Dashboard" },
  { key: "onboarding", label: "Onboarding Form" },
  { key: "mark-attendance", label: "Mark Attendance" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "holidays", label: "Holidays" },
];

export function defaultPermissionFor(moduleKey) {
  if (moduleKey === "overview" || moduleKey === "onboarding") {
    return { canView: true, canCreate: false, canEdit: false, canDelete: false };
  }

  return { canView: false, canCreate: false, canEdit: false, canDelete: false };
}

export function buildPermissionMap(rows) {
  const rowByModule = new Map(rows.map((row) => [row.moduleKey, row]));

  return Object.fromEntries(
    employeeModules.map((module) => {
      const row = rowByModule.get(module.key);
      const fallback = defaultPermissionFor(module.key);

      return [
        module.key,
        {
          canView: row?.canView ?? fallback.canView,
          canCreate: row?.canCreate ?? fallback.canCreate,
          canEdit: row?.canEdit ?? fallback.canEdit,
          canDelete: row?.canDelete ?? fallback.canDelete,
        },
      ];
    }),
  );
}

export function isModuleAccessAllowed(moduleKey, permissions) {
  if (moduleKey === "overview" || moduleKey === "onboarding") return true;
  return !!permissions?.[moduleKey]?.canView;
}
