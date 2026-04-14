// import { Request, Response, NextFunction } from 'express';
// import jwtHelper, { JwtPayload } from '../utils/jwtHelper';
// import { getRedisClient } from '../config/redis';
// import { UserRole } from '../models/User';

// /**
//  * Extend Express Request interface to include user
//  */
// declare global {
//   namespace Express {
//     interface Request {
//       user?: JwtPayload;
//     }
//   }
// }

// /**
//  * Authentication Middleware
//  * Verifies JWT token and checks Redis session
//  */
// export const authenticate = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const authHeader = req.headers.authorization;

//     // 1. Check token exists
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       res.status(401).json({
//         success: false,
//         message: 'Access token required',
//       });
//       return;
//     }

//     // 2. Extract token
//     const token = authHeader.split(' ')[1];

//     // 3. Verify token
//     let decoded: JwtPayload;

//     try {
//       decoded = jwtHelper.verifyAccessToken(token);
//     } catch (error) {
//       res.status(401).json({
//         success: false,
//         message: error instanceof Error ? error.message : 'Invalid token',
//       });
//       return;
//     }

//     // 4. Check Redis session (optional but industry-level security)
//     const redis = getRedisClient();
//     const session = await redis.get(`user_session:${decoded.userId}`);

//     if (!session) {
//       res.status(401).json({
//         success: false,
//         message: 'Session expired. Please login again',
//       });
//       return;
//     }

//     // 5. Attach user to request
//     req.user = decoded;

//     next();
//   } catch (error) {
//     console.error('Authentication Error:', error);

//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };

// /**
//  * Authorization Middleware
//  * Allows only specific roles
//  */
// export const authorize = (...allowedRoles: UserRole[]) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     // 1. Check authentication first
//     if (!req.user) {
//       res.status(401).json({
//         success: false,
//         message: 'User not authenticated',
//       });
//       return;
//     }

//     // 2. Check role
//     if (!allowedRoles.includes(req.user.role)) {
//       res.status(403).json({
//         success: false,
//         message: 'You do not have permission to access this resource',
//       });
//       return;
//     }

//     next();
//   };
// };

// /**
//  * Optional Authentication Middleware
//  * If token exists → attach user
//  * If not → continue without error
//  */
// export const optionalAuth = async (
//   req: Request,
//   _res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       next();
//       return;
//     }

//     const token = authHeader.split(' ')[1];

//     try {
//       const decoded = jwtHelper.verifyAccessToken(token);
//       req.user = decoded;
//     } catch {
//       // Invalid token — ignore silently
//     }

//     next();
//   } catch {
//     next();
//   }
// };


import { Request, Response, NextFunction } from 'express';
import jwtHelper from '../utils/jwtHelper';

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Access token missing');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwtHelper.verifyAccessToken(token);

    (req as any).user = decoded;

    next();
  } catch (error) {
    next(error);
  }
};