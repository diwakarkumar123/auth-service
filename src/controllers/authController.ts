import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import authService from '../services/authService';
import logger from '../utils/logger';

class AuthController {

  /* =====================================================
     REGISTER
     ===================================================== */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { email, password, role } = req.body;

      const result = await authService.register({ email, password, role });

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user.toJSON(),
        },
      });

    } catch (error) {
      logger.error('Register error:', error);

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  }

  /* =====================================================
     VERIFY EMAIL
     ===================================================== */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Verification token is required',
        });
        return;
      }

      const result = await authService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: result.message,
      });

    } catch (error) {
      logger.error('Email verification error:', error);

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Email verification failed',
      });
    }
  }

  /* =====================================================
     LOGIN
     ===================================================== */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const result = await authService.login({ email, password });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user.toJSON(),
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
      });

    } catch (error) {
      logger.error('Login error:', error);

      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  }

  /* =====================================================
     REFRESH TOKEN
     ===================================================== */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
        return;
      }

      const tokens = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens,
      });

    } catch (error) {
      logger.error('Refresh token error:', error);

      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  }

  /* =====================================================
     LOGOUT
     ===================================================== */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      await authService.logout(userId, refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });

    } catch (error) {
      logger.error('Logout error:', error);

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Logout failed',
      });
    }
  }

  /* =====================================================
     REQUEST PASSWORD RESET
     ===================================================== */
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required',
        });
        return;
      }

      const result = await authService.requestPasswordReset(email);

      res.status(200).json({
        success: true,
        message: result.message,
      });

    } catch (error) {
      logger.error('Password reset request error:', error);

      res.status(400).json({
        success: false,
        message: 'Failed to process password reset request',
      });
    }
  }

  /* =====================================================
     RESET PASSWORD
     ===================================================== */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Token and new password are required',
        });
        return;
      }

      const result = await authService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });

    } catch (error) {
      logger.error('Password reset error:', error);

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password reset failed',
      });
    }
  }

  /* =====================================================
     CHANGE PASSWORD
     ===================================================== */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
        });
        return;
      }

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });

    } catch (error) {
      logger.error('Change password error:', error);

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password change failed',
      });
    }
  }

  /* =====================================================
     GET PROFILE
     ===================================================== */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const user = await authService.getProfile(userId);

      res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
        },
      });

    } catch (error) {
      logger.error('Get profile error:', error);

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch profile',
      });
    }
  }

  /* =====================================================
     HEALTH CHECK
     ===================================================== */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Auth service is running',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new AuthController();