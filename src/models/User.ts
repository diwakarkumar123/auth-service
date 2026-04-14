import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

/* =====================================================
   1. USER ROLES
   ===================================================== */

export enum UserRole {
  STUDENT = 'student',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin',
}

/* =====================================================
   2. ALL USER FIELDS (table structure)
   ===================================================== */

export interface UserAttributes {
  id: number;
  email: string;
  password: string;
  role: UserRole;

  isVerified: boolean;
  isActive: boolean;

  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;

  loginAttempts: number;
  lockUntil: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

/* =====================================================
   3. FIELDS REQUIRED DURING USER CREATION
   (id, timestamps, etc not required while creating)
   ===================================================== */

export interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | 'id'
    | 'isVerified'
    | 'isActive'
    | 'emailVerifiedAt'
    | 'lastLoginAt'
    | 'loginAttempts'
    | 'lockUntil'
  > {}

/* =====================================================
   4. USER MODEL CLASS
   ===================================================== */

class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public email!: string;
  public password!: string;
  public role!: UserRole;

  public isVerified!: boolean;
  public isActive!: boolean;

  public emailVerifiedAt!: Date | null;
  public lastLoginAt!: Date | null;

  public loginAttempts!: number;
  public lockUntil!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /* =====================================================
     5. CHECK PASSWORD
     ===================================================== */
  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  /* =====================================================
     6. CHECK ACCOUNT LOCKED OR NOT
     ===================================================== */
  public isLocked(): boolean {
    return !!(this.lockUntil && this.lockUntil > new Date());
  }

  /* =====================================================
     7. INCREMENT LOGIN ATTEMPTS
     ===================================================== */
  public async incrementLoginAttempts(): Promise<void> {
    const maxAttempts = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockTime = Number(process.env.LOCK_TIME) || 900000; // 15 min

    if (this.lockUntil && this.lockUntil < new Date()) {
      // Lock expired → reset
      await this.update({
        loginAttempts: 1,
        lockUntil: null,
      });
      return;
    }

    const updates: any = {
      loginAttempts: this.loginAttempts + 1,
    };

    if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
      updates.lockUntil = new Date(Date.now() + lockTime);
    }

    await this.update(updates);
  }

  /* =====================================================
     8. RESET LOGIN ATTEMPTS AFTER SUCCESSFUL LOGIN
     ===================================================== */
  public async resetLoginAttempts(): Promise<void> {
    await this.update({
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
    });
  }

  /* =====================================================
     9. REMOVE PASSWORD FROM RESPONSE
     ===================================================== */
  public toJSON(): Partial<UserAttributes> {
  const values = this.get() as any;
  delete values.password;
  return values;
}
}

/* =====================================================
   10. TABLE STRUCTURE
   ===================================================== */

User.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [8, 255],
      },
    },

    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.STUDENT,
    },

    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_verified',
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },

    emailVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_verified_at',
    },

    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
    },

    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'login_attempts',
    },

    lockUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'lock_until',
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    underscored: true,

    /* =====================================================
       11. PASSWORD HASHING HOOK
       ===================================================== */
    hooks: {
      beforeCreate: async (user: User) => {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      },

      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export default User;