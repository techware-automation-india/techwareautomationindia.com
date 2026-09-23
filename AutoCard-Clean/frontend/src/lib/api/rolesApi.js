import { apiGet, apiPost, apiPut, apiDelete } from '../api.js';

/**
 * Fetch all roles with their module access
 * @returns {Promise<Object>} Response containing roles array and validModules
 * @throws {Error} If the request fails
 */
export async function fetchRoles() {
  try {
    return await apiGet('/roles');
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    throw new Error(error.message || 'Failed to fetch roles');
  }
}

/**
 * Create a new custom role
 * @param {string} name - The name of the role to create
 * @returns {Promise<Object>} The created role object
 * @throws {Error} If the request fails or validation fails
 */
export async function createRole(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Role name is required and must be a string');
  }

  if (name.length < 1 || name.length > 100) {
    throw new Error('Role name must be between 1 and 100 characters');
  }

  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    throw new Error('Role name can only contain alphanumeric characters, spaces, hyphens, and underscores');
  }

  try {
    return await apiPost('/roles', { name });
  } catch (error) {
    console.error('Failed to create role:', error);
    throw new Error(error.message || 'Failed to create role');
  }
}

/**
 * Update a role's name
 * @param {string} id - The ID of the role to update
 * @param {string} name - The new name for the role
 * @returns {Promise<Object>} The updated role object
 * @throws {Error} If the request fails or validation fails
 */
export async function updateRole(id, name) {
  if (!id || typeof id !== 'string') {
    throw new Error('Role ID is required and must be a string');
  }

  if (!name || typeof name !== 'string') {
    throw new Error('Role name is required and must be a string');
  }

  if (name.length < 1 || name.length > 100) {
    throw new Error('Role name must be between 1 and 100 characters');
  }

  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    throw new Error('Role name can only contain alphanumeric characters, spaces, hyphens, and underscores');
  }

  try {
    return await apiPut(`/roles/${id}`, { name });
  } catch (error) {
    console.error('Failed to update role:', error);
    throw new Error(error.message || 'Failed to update role');
  }
}

/**
 * Delete a custom role
 * @param {string} id - The ID of the role to delete
 * @returns {Promise<Object>} Confirmation message
 * @throws {Error} If the request fails or role cannot be deleted
 */
export async function deleteRole(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Role ID is required and must be a string');
  }

  try {
    return await apiDelete(`/roles/${id}`);
  } catch (error) {
    console.error('Failed to delete role:', error);
    throw new Error(error.message || 'Failed to delete role');
  }
}

/**
 * Fetch module access for a specific role
 * @param {string} id - The ID of the role
 * @returns {Promise<Object>} Role object with modules array
 * @throws {Error} If the request fails
 */
export async function fetchRoleModules(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Role ID is required and must be a string');
  }

  try {
    return await apiGet(`/roles/${id}/modules`);
  } catch (error) {
    console.error('Failed to fetch role modules:', error);
    throw new Error(error.message || 'Failed to fetch role modules');
  }
}

/**
 * Update module access for a role
 * @param {string} id - The ID of the role
 * @param {string[]} moduleKeys - Array of module keys to assign to the role
 * @returns {Promise<Object>} Updated role object with modules
 * @throws {Error} If the request fails or validation fails
 */
export async function updateRoleModules(id, moduleKeys) {
  if (!id || typeof id !== 'string') {
    throw new Error('Role ID is required and must be a string');
  }

  if (!Array.isArray(moduleKeys)) {
    throw new Error('Module keys must be an array');
  }

  // Validate all module keys are strings
  if (moduleKeys.some(key => typeof key !== 'string')) {
    throw new Error('All module keys must be strings');
  }

  try {
    return await apiPut(`/roles/${id}/modules`, { moduleKeys });
  } catch (error) {
    console.error('Failed to update role modules:', error);
    throw new Error(error.message || 'Failed to update role modules');
  }
}
