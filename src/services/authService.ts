import User, { UserRole } from '../models/User';
import RefreshToken from '../models/RefreshToken';
import PasswordReset from '../models/PasswordReset';
import jwtHelper, { JwtPayload, TokenPair } from '../utils/jwtHelper';
import emailService from './emailService';
import { getRedisClient } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/* =====================================================
   INTERFACES
   ===================================================== */

export interface RegisterData {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginData {
  email: string;
  password: string;
}

/* =====================================================
   AUTH SERVICE
   ===================================================== */

class AuthService {

  /* =====================================================
     REGISTER USER
     ===================================================== */
  async register(data: RegisterData): Promise<{ user: User; message: string }> {
    const existingUser = await User.findOne({ where: { email: data.email } });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = await User.create({
      email: data.email,
      password: data.password,
      role: data.role || UserRole.STUDENT,
      isVerified: false,
      isActive: true,
    });

    const verificationToken = uuidv4();
    const redis = getRedisClient();

    const expiresIn = parseInt(
      process.env.EMAIL_VERIFICATION_EXPIRES_IN || '86400000'
    );

    await redis.setEx(
      `email_verify:${verificationToken}`,
      Math.floor(expiresIn / 1000),
      user.id.toString()   // ← number to string
    );

    await emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  /* =====================================================
     VERIFY EMAIL
     ===================================================== */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const redis = getRedisClient();
    const userId = await redis.get(`email_verify:${token}`);

    if (!userId) {
      throw new Error('Invalid or expired verification token');
    }

    const user = await User.findByPk(Number(userId));

    if (!user) throw new Error('User not found');

    if (user.isVerified) throw new Error('Email already verified');

    await user.update({
      isVerified: true,
      emailVerifiedAt: new Date(),
    });

    await redis.del(`email_verify:${token}`);

    await emailService.sendWelcomeEmail(user.email, user.email.split('@')[0]);

    return { message: 'Email verified successfully' };
  }

  /* =====================================================
     LOGIN USER
     ===================================================== */
  async login(data: LoginData): Promise<{ user: User; tokens: TokenPair }> {
    const user = await User.findOne({ where: { email: data.email } });

    if (!user) throw new Error('Invalid email or password');

    if (!user.isActive) throw new Error('Account has been deactivated');

    const isPasswordValid = await user.comparePassword(data.password);

    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new Error('Invalid email or password');
    }

    if (!user.isVerified)
      throw new Error('Please verify your email before logging in');

    await user.resetLoginAttempts();

    const payload: JwtPayload = {
      userId: user.id,        // ← ab number hai, string nahi
      email: user.email,
      role: user.role,
    };

    const tokens = jwtHelper.generateTokenPair(payload);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: refreshExpiry,
    });

    const redis = getRedisClient();

    await redis.setEx(
      `user_session:${user.id}`,
      3600,
      JSON.stringify(payload)
    );

    return { user, tokens };
  }

  /* =====================================================
     REFRESH ACCESS TOKEN
     ===================================================== */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;

    try {
      payload = jwtHelper.verifyRefreshToken(refreshToken);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const storedToken = await RefreshToken.findOne({
      where: { token: refreshToken, userId: payload.userId },
    });

    if (!storedToken) throw new Error('Refresh token not found');

    if (storedToken.isExpired()) {
      await storedToken.destroy();
      throw new Error('Refresh token expired');
    }

    const user = await User.findByPk(payload.userId);

    if (!user || !user.isActive)
      throw new Error('User not found or inactive');

    const newPayload: JwtPayload = {
      userId: user.id,        // ← ab number hai
      email: user.email,
      role: user.role,
    };

    const tokens = jwtHelper.generateTokenPair(newPayload);

    await storedToken.destroy();

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: refreshExpiry,
    });

    return tokens;
  }

  /* =====================================================
     LOGOUT USER
     ===================================================== */
  async logout(userId: number, refreshToken: string): Promise<{ message: string }> {
    await RefreshToken.destroy({
      where: { userId, token: refreshToken },
    });

    const redis = getRedisClient();
    await redis.del(`user_session:${userId}`);

    return { message: 'Logged out successfully' };
  }

  /* =====================================================
     REQUEST PASSWORD RESET
     ===================================================== */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await PasswordReset.destroy({ where: { email } });

    await PasswordReset.create({
      email,
      token: resetToken,
      expiresAt,
    });

    await emailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  /* =====================================================
     RESET PASSWORD
     ===================================================== */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const resetRecord = await PasswordReset.findOne({ where: { token } });

    if (!resetRecord) {
      throw new Error('Invalid or expired reset token');
    }

    if (resetRecord.isExpired()) {
      await resetRecord.destroy();
      throw new Error('Reset token expired');
    }

    const user = await User.findOne({
      where: { email: resetRecord.email },
    });

    if (!user) throw new Error('User not found');

    await user.update({ password: newPassword });

    await resetRecord.destroy();

    await RefreshToken.destroy({ where: { userId: user.id } });

    const redis = getRedisClient();
    await redis.del(`user_session:${user.id}`);

    return { message: 'Password reset successfully' };
  }

  /* =====================================================
     CHANGE PASSWORD
     ===================================================== */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await User.findByPk(userId);

    if (!user) throw new Error('User not found');

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid)
      throw new Error('Current password is incorrect');

    await user.update({ password: newPassword });

    await RefreshToken.destroy({ where: { userId: user.id } });

    const redis = getRedisClient();
    await redis.del(`user_session:${user.id}`);

    return { message: 'Password changed successfully' };
  }

  /* =====================================================
     GET USER PROFILE
     ===================================================== */
  async getProfile(userId: number): Promise<User> {
    const user = await User.findByPk(userId);

    if (!user) throw new Error('User not found');

    return user;
  }
}

export default new AuthService();