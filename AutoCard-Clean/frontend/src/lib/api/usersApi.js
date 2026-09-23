import { apiGet, apiPut } from "../api.js";

/**
 * Fetch all users with their assigned roles
 * 
 * @returns {Promise<Array>} Array of users with role information
 * @throws {Error} If the request fails
 * 
 * Validates: Requirements 14.1
 */
export async function fetchUsersWithRoles() {
  try {
    const response = await apiGet("/users/with-roles");
    return response?.users || response || [];
  } catch (error) {
    console.error("Failed to fetch users with roles:", error);
    throw new Error(error.message || "Failed to fetch users with roles");
  }
}

/**
 * Assign a role to a user
 * 
 * @param {string} userId - The ID of the user to assign the role to
 * @param {string} roleId - The ID of the role to assign
 * @returns {Promise<Object>} Updated user object with role information
 * @throws {Error} If the request fails
 * 
 * Validates: Requirements 14.2
 */
export async function assignUserRole(userId, roleId) {
  try {
    if (!userId || !roleId) {
      throw new Error("User ID and Role ID are required");
    }

    const response = await apiPut(`/users/${userId}/role`, { roleId });
    return response;
  } catch (error) {
    console.error("Failed to assign user role:", error);
    throw new Error(error.message || "Failed to assign role to user");
  }
}

/**
 * Fetch users filtered by a specific role
 * 
 * @param {string} roleId - The ID of the role to filter by
 * @returns {Promise<Array>} Array of users with the specified role
 * @throws {Error} If the request fails
 * 
 * Validates: Requirements 14.3
 */
export async function fetchUsersByRole(roleId) {
  try {
    if (!roleId) {
      throw new Error("Role ID is required");
    }

    const response = await apiGet(`/users/by-role/${roleId}`);
    return response;
  } catch (error) {
    console.error("Failed to fetch users by role:", error);
    throw new Error(error.message || "Failed to fetch users by role");
  }
}
