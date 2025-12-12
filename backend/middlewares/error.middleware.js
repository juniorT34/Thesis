import CustomError from '../utils/CustomError.js';
import logger from '../utils/logger.js';

const handleCastErrorDB = err => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new CustomError(message, 400);
};

const handleDuplicateFieldsDB = err => {
    const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new CustomError(message, 400);
};

const handleValidationErrorDB = err => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new CustomError(message, 400);
};

const errorMiddleware = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        let error = { ...err };
        error.message = err.message;

        // Handle MongoDB Errors
        if (err.name === 'CastError') error = handleCastErrorDB(err);
        if (err.code === 11000) error = handleDuplicateFieldsDB(err);
        if (err.name === 'ValidationError') error = handleValidationErrorDB(err);

        // Handle Authentication & Authorization Errors
        if (err.name === 'NotFoundError') {
            error = new CustomError('Resource not found', 404);
        }
        if (err.name === 'ForbiddenError') {
            error = new CustomError('Forbidden', 403);
        }
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            error = new CustomError('Invalid or expired token', 401);
        }

        // Handle Environment & System Errors
        if (err.message.includes('ENOENT')) {
            error = new CustomError('Missing critical environment variables', 500);
        }

        if (error.isOperational) {
            res.status(error.statusCode).json({
                status: error.status,
                message: error.message
            });
        } else {
            // Programming or unknown errors: don't leak error details
            logger.error('ERROR ', err);
            res.status(500).json({
                status: 'error',
                message: 'Something went wrong!'
            });
        }
    }
};

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION!  Shutting down...');
    logger.error(err);
    process.exit(1);
});

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION!  Shutting down...');
    logger.error(err);
    process.exit(1);
});

export default errorMiddleware;
