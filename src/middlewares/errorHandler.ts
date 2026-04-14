// import { Request, Response, NextFunction } from 'express';
// import logger from '../utils/logger';

// /* =====================================================
//    GLOBAL ERROR HANDLER
//    ===================================================== */

// const errorHandler = (
//   err: Error,
//   req: Request,
//   res: Response,
//   _next: NextFunction
// ): void => {
//   logger.error('Error:', {
//     message: err.message,
//     stack: err.stack,
//     path: req.path,
//     method: req.method,
//   });

//   res.status(500).json({
//     success: false,
//     message:
//       process.env.NODE_ENV === 'development'
//         ? err.message
//         : 'Internal server error',
//   });
// };

// /* =====================================================
//    404 NOT FOUND HANDLER
//    ===================================================== */

// export const notFound = (req: Request, res: Response): void => {
//   res.status(404).json({
//     success: false,
//     message: `Route not found: ${req.originalUrl}`,
//   });
// };

// export default errorHandler;

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(err.message);

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error',
  });
};

export default errorHandler;