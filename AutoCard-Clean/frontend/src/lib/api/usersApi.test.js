import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUsersWithRoles, assignUserRole, fetchUsersByRole } from './usersApi.js';
import * as api from '../api.js';

// Mock the API module
vi.mock('../api.js', () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

describe('usersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchUsersWithRoles', () => {
    it('should call apiGet with correct endpoint', async () => {
      const mockUsers = [
        { id: '1', fullName: 'John Doe', email: 'john@example.com', role: { name: 'Admin' } }
      ];
      vi.mocked(api.apiGet).mockResolvedValue(mockUsers);

      const result = await fetchUsersWithRoles();

      expect(api.apiGet).toHaveBeenCalledWith('/users/with-roles');
      expect(result).toEqual(mockUsers);
    });

    it('should handle errors and throw descriptive message', async () => {
      const errorMessage = 'Network error';
      vi.mocked(api.apiGet).mockRejectedValue(new Error(errorMessage));

      await expect(fetchUsersWithRoles()).rejects.toThrow(errorMessage);
    });
  });

  describe('assignUserRole', () => {
    it('should call apiPut with correct endpoint and payload', async () => {
      const userId = 'user-123';
      const roleId = 'role-456';
      const mockResponse = { 
        id: userId, 
        fullName: 'John Doe', 
        role: { id: roleId, name: 'Manager' } 
      };
      vi.mocked(api.apiPut).mockResolvedValue(mockResponse);

      const result = await assignUserRole(userId, roleId);

      expect(api.apiPut).toHaveBeenCalledWith(`/users/${userId}/role`, { roleId });
      expect(result).toEqual(mockResponse);
    });

    it('should validate required parameters', async () => {
      await expect(assignUserRole('', 'role-123')).rejects.toThrow('User ID and Role ID are required');
      await expect(assignUserRole('user-123', '')).rejects.toThrow('User ID and Role ID are required');
      await expect(assignUserRole(null, 'role-123')).rejects.toThrow('User ID and Role ID are required');
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Invalid role ID';
      vi.mocked(api.apiPut).mockRejectedValue(new Error(errorMessage));

      await expect(assignUserRole('user-123', 'role-456')).rejects.toThrow(errorMessage);
    });
  });

  describe('fetchUsersByRole', () => {
    it('should call apiGet with correct endpoint and roleId', async () => {
      const roleId = 'role-789';
      const mockUsers = [
        { id: '1', fullName: 'Jane Doe', email: 'jane@example.com', roleId }
      ];
      vi.mocked(api.apiGet).mockResolvedValue(mockUsers);

      const result = await fetchUsersByRole(roleId);

      expect(api.apiGet).toHaveBeenCalledWith(`/users/by-role/${roleId}`);
      expect(result).toEqual(mockUsers);
    });

    it('should validate roleId is provided', async () => {
      await expect(fetchUsersByRole('')).rejects.toThrow('Role ID is required');
      await expect(fetchUsersByRole(null)).rejects.toThrow('Role ID is required');
    });

    it('should handle errors and throw descriptive message', async () => {
      const errorMessage = 'Role not found';
      vi.mocked(api.apiGet).mockRejectedValue(new Error(errorMessage));

      await expect(fetchUsersByRole('role-789')).rejects.toThrow(errorMessage);
    });
  });
});
