/**
 * Unit tests for checkRolePermission middleware
 * 
 * Tests verify:
 * - Admin bypass
 * - User without roleId gets 403
 * - User with role and module access gets through
 * - User without module access gets 403
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRolePermission } from './checkRolePermission.js';

// Mock Prisma client
const mockPrisma = {
  roleModule: {
    findUnique: vi.fn(),
  },
};

// Mock the prisma import
vi.mock('../prismaClient.js', () => ({
  default: mockPrisma,
}));

describe('checkRolePermission middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup standard req, res, next objects
    req = {
      user: null,
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  describe('Admin bypass', () => {
    it('should allow admin users to access any module', async () => {
      req.user = {
        id: 'admin-1',
        role: 'ADMIN',
        roleId: 'some-role-id',
      };

      const middleware = checkRolePermission('employee');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockPrisma.roleModule.findUnique).not.toHaveBeenCalled();
    });

    it('should bypass permission check even if admin has no roleId', async () => {
      req.user = {
        id: 'admin-1',
        role: 'ADMIN',
        roleId: null,
      };

      const middleware = checkRolePermission('employee');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockPrisma.roleModule.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('No role assigned', () => {
    it('should return 403 if user has no roleId', async () => {
      req.user = {
        id: 'user-1',
        role: 'EMPLOYEE',
        roleId: null,
      };

      const middleware = checkRolePermission('employee');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No role assigned. Access denied.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not set', async () => {
      req.user = null;

      const middleware = checkRolePermission('employee');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No role assigned. Access denied.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Module access granted', () => {
    it('should allow access when user has module in their role', async () => {
      req.user = {
        id: 'user-1',
        role: 'EMPLOYEE',
        roleId: 'role-123',
      };

      mockPrisma.roleModule.findUnique.mockResolvedValue({
        roleId: 'role-123',
        moduleKey: 'employee',
      });

      const middleware = checkRolePermission('employee');
      await middleware(req, res, next);

      expect(mockPrisma.roleModule.findUnique).toHaveBeenCalledWith({
        where: {
          roleId_moduleKey: {
            roleId: 'role-123',
            moduleKey: 'employee',
          },
        },
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Module access denied', () => {
    it('should deny access when user does not have module in their role', async () => {
      req.user = {
        id: 'user-1',
        role: 'EMPLOYEE',
        roleId: 'role-123',
      };

      mockPrisma.roleModule.findUnique.mockResolvedValue(null);

      const middleware = checkRolePermission('attendance');
      await middleware(req, res, next);

      expect(mockPrisma.roleModule.findUnique).toHaveBeenCalledWith({
        where: {
          roleId_moduleKey: {
            roleId: 'role-123',
            moduleKey: 'attendance',
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Access denied to attendance module.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should return 500 on database error', async () => {
      req.user = {
        id: 'user-1',
        role: 'EMPLOYEE',
        roleId: 'role-123',
      };

      const dbError = new Error('Database connection failed');
      mockPrisma.roleModule.findUnique.mockRejectedValue(dbError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      const middleware = checkRolePermission('employee');
      await middleware(req, res, next);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[checkRolePermission] Error:',
        dbError
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to verify permissions.',
      });
      expect(next).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Multiple module keys', () => {
    it('should work with different module keys', async () => {
      const testCases = [
        'overview',
        'employee',
        'requests',
        'approvals',
        'mark-attendance',
        'attendance',
        'roles-access',
        'shift-location',
        'roster',
      ];

      for (const moduleKey of testCases) {
        vi.clearAllMocks();

        req.user = {
          id: 'user-1',
          role: 'EMPLOYEE',
          roleId: 'role-123',
        };

        mockPrisma.roleModule.findUnique.mockResolvedValue({
          roleId: 'role-123',
          moduleKey,
        });

        const middleware = checkRolePermission(moduleKey);
        await middleware(req, res, next);

        expect(mockPrisma.roleModule.findUnique).toHaveBeenCalledWith({
          where: {
            roleId_moduleKey: {
              roleId: 'role-123',
              moduleKey,
            },
          },
        });
        expect(next).toHaveBeenCalledTimes(1);
      }
    });
  });
});
