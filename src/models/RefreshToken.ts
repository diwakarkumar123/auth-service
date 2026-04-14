import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface RefreshTokenAttributes {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt?: Date;
}

export interface RefreshTokenCreationAttributes
  extends Optional<RefreshTokenAttributes, 'id'> {}

class RefreshToken
  extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes>
  implements RefreshTokenAttributes
{
  public id!: number;
  public userId!: number;
  public token!: string;
  public expiresAt!: Date;
  public readonly createdAt!: Date;

  public isExpired(): boolean {
    return this.expiresAt < new Date();
  }
}

RefreshToken.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
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
    tableName: 'refresh_tokens',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export default RefreshToken;