import { useAuth } from '../context/AuthContext.jsx';

/**
 * Returns helpers to check whether the current user can access a given
 * screen, chart, or subtab.  Superadmins always get true.
 * Users with no role assigned (permissions === null) also get full access.
 */
export function usePermissions() {
  const { user } = useAuth();

  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const perms = user?.permissions ?? null;

  /** Can the user see this screen at all? */
  const can = (screen) => {
    if (isSuperAdmin) return true;
    if (!perms) return true;
    return perms[screen]?.visible !== false;
  };

  /** Can the user see a specific chart within a screen? */
  const canChart = (screen, chartId) => {
    if (isSuperAdmin) return true;
    if (!perms) return true;
    if (perms[screen]?.visible === false) return false;
    return perms[screen]?.charts?.[chartId] !== false;
  };

  /** Can the user see a subtab within a screen (e.g. subtab_overview)? */
  const canSubtab = (screen, key) => {
    if (isSuperAdmin) return true;
    if (!perms) return true;
    if (perms[screen]?.visible === false) return false;
    return perms[screen]?.[key] !== false;
  };

  return { can, canChart, canSubtab };
}
