import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  fetchRoles, 
  createRole, 
  updateRole, 
  deleteRole, 
  fetchRoleModules, 
  updateRoleModules 
} from './rolesApi';
import * as api from '../api';

// Mock the api module
vi.mock('../api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('rolesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchRoles', () => {
    it('successfully fetches all roles', async () => {
      const mockRoles = {
        roles: [
          { id: '1', name: 'Admin', isDefault: true, modules: ['overview'] },
          { id: '2', name: 'Employee', isDefault: true, modules: ['overview'] }
        ],
        validModules: ['overview', 'employee', 'requests']
      };

      vi.mocked(api.apiGet).mockResolvedValue(mockRoles);

      const result = await fetchRoles();

      expect(api.apiGet).toHaveBeenCalledWith('/roles');
      expect(result).toEqual(mockRoles);
    });

    it('throws error when fetch fails', async () => {
      const errorMessage = 'Network error';
      vi.mocked(api.apiGet).mockRejectedValue(new Error(errorMessage));

      await expect(fetchRoles()).rejects.toThrow('Network error');
    });
  });

  describe('createRole', () => {
    it('successfully creates a role with valid name', async () => {
      const mockRole = { id: '3', name: 'Manager', isDefault: false, modules: [] };
      vi.mocked(api.apiPost).mockResolvedValue(mockRole);

      const result = await createRole('Manager');

      expect(api.apiPost).toHaveBeenCalledWith('/roles', { name: 'Manager' });
      expect(result).toEqual(mockRole);
    });

    it('validates role name is required', async () => {
      await expect(createRole()).rejects.toThrow('Role name is required and must be a string');
      await expect(createRole('')).rejects.toThrow('Role name must be between 1 and 100 characters');
    });

    it('validates role name length', async () => {
      const longName = 'a'.repeat(101);
      await expect(createRole(longName)).rejects.toThrow('Role name must be between 1 and 100 characters');
    });

    it('validates role name characters', async () => {
      await expect(createRole('Invalid@Role!')).rejects.toThrow(
        'Role name can only contain alphanumeric characters, spaces, hyphens, and underscores'
      );
    });

    it('accepts valid role names with spaces, hyphens, and underscores', async () => {
      const mockRole = { id: '4', name: 'Test-Role_123', isDefault: false, modules: [] };
      vi.mocked(api.apiPost).mockResolvedValue(mockRole);

      const result = await createRole('Test-Role_123');

      expect(api.apiPost).toHaveBeenCalledWith('/roles', { name: 'Test-Role_123' });
      expect(result).toEqual(mockRole);
    });

    it('throws error when creation fails', async () => {
      vi.mocked(api.apiPost).mockRejectedValue(new Error('Duplicate role name'));

      await expect(createRole('Admin')).rejects.toThrow('Duplicate role name');
    });
  });

  describe('updateRole', () => {
    it('successfully updates a role name', async () => {
      const mockRole = { id: '3', name: 'Updated Manager', isDefault: false, modules: [] };
      vi.mocked(api.apiPut).mockResolvedValue(mockRole);

      const result = await updateRole('3', 'Updated Manager');

      expect(api.apiPut).toHaveBeenCalledWith('/roles/3', { name: 'Updated Manager' });
      expect(result).toEqual(mockRole);
    });

    it('validates role ID is required', async () => {
      await expect(updateRole(null, 'Manager')).rejects.toThrow('Role ID is required and must be a string');
    });

    it('validates role name is required', async () => {
      await expect(updateRole('3', '')).rejects.toThrow('Role name must be between 1 and 100 characters');
    });

    it('validates role name length', async () => {
      const longName = 'a'.repeat(101);
      await expect(updateRole('3', longName)).rejects.toThrow('Role name must be between 1 and 100 characters');
    });

    it('validates role name characters', async () => {
      await expect(updateRole('3', 'Invalid@Role!')).rejects.toThrow(
        'Role name can only contain alphanumeric characters, spaces, hyphens, and underscores'
      );
    });

    it('throws error when update fails', async () => {
      vi.mocked(api.apiPut).mockRejectedValue(new Error('Cannot update default role'));

      await expect(updateRole('1', 'New Name')).rejects.toThrow('Cannot update default role');
    });
  });

  describe('deleteRole', () => {
    it('successfully deletes a role', async () => {
      const mockResponse = { message: 'Role deleted successfully' };
      vi.mocked(api.apiDelete).mockResolvedValue(mockResponse);

      const result = await deleteRole('3');

      expect(api.apiDelete).toHaveBeenCalledWith('/roles/3');
      expect(result).toEqual(mockResponse);
    });

    it('validates role ID is required', async () => {
      await expect(deleteRole()).rejects.toThrow('Role ID is required and must be a string');
      await expect(deleteRole('')).rejects.toThrow('Role ID is required and must be a string');
    });

    it('throws error when deletion fails', async () => {
      vi.mocked(api.apiDelete).mockRejectedValue(new Error('Cannot delete default role'));

      await expect(deleteRole('1')).rejects.toThrow('Cannot delete default role');
    });
  });

  describe('fetchRoleModules', () => {
    it('successfully fetches role modules', async () => {
      const mockRoleModules = {
        id: '3',
        name: 'Manager',
        modules: ['overview', 'employee', 'requests']
      };
      vi.mocked(api.apiGet).mockResolvedValue(mockRoleModules);

      const result = await fetchRoleModules('3');

      expect(api.apiGet).toHaveBeenCalledWith('/roles/3/modules');
      expect(result).toEqual(mockRoleModules);
    });

    it('validates role ID is required', async () => {
      await expect(fetchRoleModules()).rejects.toThrow('Role ID is required and must be a string');
    });

    it('throws error when fetch fails', async () => {
      vi.mocked(api.apiGet).mockRejectedValue(new Error('Role not found'));

      await expect(fetchRoleModules('999')).rejects.toThrow('Role not found');
    });
  });

  describe('updateRoleModules', () => {
    it('successfully updates role modules', async () => {
      const mockUpdatedRole = {
        id: '3',
        name: 'Manager',
        modules: ['overview', 'employee']
      };
      vi.mocked(api.apiPut).mockResolvedValue(mockUpdatedRole);

      const result = await updateRoleModules('3', ['overview', 'employee']);

      expect(api.apiPut).toHaveBeenCalledWith('/roles/3/modules', { 
        moduleKeys: ['overview', 'employee'] 
      });
      expect(result).toEqual(mockUpdatedRole);
    });

    it('validates role ID is required', async () => {
      await expect(updateRoleModules(null, [])).rejects.toThrow('Role ID is required and must be a string');
    });

    it('validates moduleKeys is an array', async () => {
      await expect(updateRoleModules('3', 'not-an-array')).rejects.toThrow('Module keys must be an array');
    });

    it('validates all module keys are strings', async () => {
      await expect(updateRoleModules('3', ['valid', 123, 'another'])).rejects.toThrow(
        'All module keys must be strings'
      );
    });

    it('accepts empty module keys array', async () => {
      const mockUpdatedRole = {
        id: '3',
        name: 'Manager',
        modules: []
      };
      vi.mocked(api.apiPut).mockResolvedValue(mockUpdatedRole);

      const result = await updateRoleModules('3', []);

      expect(api.apiPut).toHaveBeenCalledWith('/roles/3/modules', { moduleKeys: [] });
      expect(result).toEqual(mockUpdatedRole);
    });

    it('throws error when update fails', async () => {
      vi.mocked(api.apiPut).mockRejectedValue(new Error('Invalid module key'));

      await expect(updateRoleModules('3', ['invalid-module'])).rejects.toThrow('Invalid module key');
    });
  });
});
