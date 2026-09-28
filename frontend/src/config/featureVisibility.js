import { useAuth } from "../context/AuthContext";

// Roles that don't get the self-service sections ("My attendance", "My overtime",
// "My leave requests") on the Attendance module pages — they only manage/approve,
// they don't clock in or request leave themselves.
//
// This is a frontend-only switch for now (the backend permissions are unchanged,
// so nothing here is a security boundary). When the Settings module ships, this
// will move into the database so an admin can toggle which features are visible
// to which role per person, instead of being hardcoded to a role name.
export const selfServiceHiddenForRoles = ["admin"];

// True when the signed-in user should see their own clock-in/history, overtime
// and leave sections. False hides them (currently: admin only).
export function useSelfServiceVisible() {
  const { roles } = useAuth();
  return !roles.some((role) => selfServiceHiddenForRoles.includes(role));
}
