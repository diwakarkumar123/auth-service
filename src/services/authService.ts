import User, { UserRole } from '../models/User';
import RefreshToken from '../models/RefreshToken';
import PasswordReset from '../models/PasswordReset';
import jwtHelper, { TokenPair } from '../utils/jwtHelper';
import emailService from './emailService';
import { getRedisClient } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface RegisterData {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginData {
  email: string;
  password: string;
}

class AuthService {
  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<{ user: User; message: string }> {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: data.email } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create user
    const user = await User.create({
      email: data.email,
      password: data.password,
      role: data.role || UserRole.STUDENT,
      isVerified: false,
      isActive: true,
    });

    // Generate verification token
    const verificationToken = uuidv4();
    const redis = getRedisClient();
    
    // Store token in Redis with 24 hours expiry
    const expiresIn = parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_IN || '86400000');
    await redis.setEx(
      `email_verify:${verificationToken}`,
      Math.floor(expiresIn / 1000),
      user.id.toString()
    );

    // Send verification email
    await emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const redis = getRedisClient();
    const userId = await redis.get(`email_verify:${token}`);

    if (!userId) {
      throw new Error('Invalid or expired verification token');
    }

    const user = await User.findByPk(parseInt(userId));
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isVerified) {
      throw new Error('Email already verified');
    }

    // Update user
    await user.update({
      isVerified: true,
      emailVerifiedAt: new Date(),
    });

    // Delete token from Redis
    await redis.del(`email_verify:${token}`);

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.email.split('@')[0]);

    return { message: 'Email verified successfully' };
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<{ user: User; tokens: TokenPair }> {
    // Find user
    const user = await User.findOne({ where: { email: data.email } });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil!.getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${lockTime} minutes`);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new Error('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isVerified) {
      throw new Error('Please verify your email before logging in');
    }

    // Reset login attempts
    await user.resetLoginAttempts();

    // Generate tokens
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = jwtHelper.generateTokenPair(payload);

    // Store refresh token in database
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: refreshTokenExpiry,
    });

    // Cache user session in Redis
    const redis = getRedisClient();
    await redis.setEx(
      `user_session:${user.id}`,
      3600, // 1 hour
      JSON.stringify({ userId: user.id, email: user.email, role: user.role })
    );

    return { user, tokens };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    let payload;
    try {
      payload = jwtHelper.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }

    // Check if refresh token exists in database
    const storedToken = await RefreshToken.findOne({
      where: { token: refreshToken, userId: payload.userId },
    });

    if (!storedToken) {
      throw new Error('Refresh token not found');
    }

    if (storedToken.isExpired()) {
      await storedToken.destroy();
      throw new Error('Refresh token expired');
    }

    // Get user
    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Generate new token pair
    const newPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = jwtHelper.generateTokenPair(newPayload);

    // Delete old refresh token
    await storedToken.destroy();

    // Store new refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: refreshTokenExpiry,
    });

    return tokens;
  }

  /**
   * Logout user
   */
  async logout(userId: number, refreshToken: string): Promise<{ message: string }> {
    // Delete refresh token from database
    await RefreshToken.destroy({
      where: { userId, token: refreshToken },
    });

    // Delete session from Redis
    const redis = getRedisClient();
    await redis.del(`user_session:${userId}`);

    return { message: 'Logged out successfully' };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a password reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Calculate expiry (1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Delete any existing reset tokens for this email
    await PasswordReset.destroy({ where: { email } });

    // Create new reset token
    await PasswordReset.create({
      email,
      token: resetToken,
      expiresAt,
    });

    // Send email
    await emailService.sendPasswordResetEmail(email, resetToken);

    return { message: 'If the email exists, a password reset link has been sent' };
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const resetRecord = await PasswordReset.findOne({ where: { token } });

    if (!resetRecord) {
      throw new Error('Invalid or expired reset token');
    }

    if (resetRecord.isExpired()) {
      await resetRecord.destroy();
      throw new Error('Reset token has expired');
    }

    // Find user
    const user = await User.findOne({ where: { email: resetRecord.email } });
    if (!user) {
      throw new Error('User not found');
    }

    // Update password
    await user.update({ password: newPassword });

    // Delete reset token
    await resetRecord.destroy();

    // Invalidate all existing sessions
    await RefreshToken.destroy({ where: { userId: user.id } });
    const redis = getRedisClient();
    await redis.del(`user_session:${user.id}`);

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password (for logged-in users)
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    await user.update({ password: newPassword });

    // Invalidate all sessions except current
    await RefreshToken.destroy({ where: { userId: user.id } });

    return { message: 'Password changed successfully' };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}

export default new AuthService();