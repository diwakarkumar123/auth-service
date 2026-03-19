import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface PasswordResetAttributes {
  id: number;
  email: string;
  token: string;
  expiresAt: Date;
  createdAt?: Date;
}

export interface PasswordResetCreationAttributes extends Optional<PasswordResetAttributes, 'id'> {}

class PasswordReset extends Model<PasswordResetAttributes, PasswordResetCreationAttributes> implements PasswordResetAttributes {
  public id!: number;
  public email!: string;
  public token!: string;
  public expiresAt!: Date;
  public readonly createdAt!: Date;

  public isExpired(): boolean {
    return this.expiresAt < new Date();
  }
}

PasswordReset.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
  },
  {
    sequelize,
    tableName: 'password_resets',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export default PasswordReset;