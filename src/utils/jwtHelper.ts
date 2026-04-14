import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: number;   // ← string se number kiya
  email: string;
  role: string;
}

export interface TokenPair {   // ← export add kiya
  accessToken: string;
  refreshToken: string;
}

const generateAccessToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, options);
};

const generateRefreshToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, options);
};

const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JwtPayload;
};

const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as JwtPayload;
};

const generateTokenPair = (payload: JwtPayload): TokenPair => {   // ← function add kiya
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
};