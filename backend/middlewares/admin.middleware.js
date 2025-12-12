import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { findUserById } from "../repositories/user.repository.js";

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    return req.headers.authorization.split(" ")[1];
  }

  if (req.query?.token) {
    return req.query.token;
  }

  return null;
};

const adminAuthorize = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if(!token){
            return res.status(401).json({
                message: 'Unauthorized'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET)

        const user = await findUserById(decoded.userId)

        if(!user || user.role !== "ADMIN") {
            return res.status(403).json({
                message: 'Forbidden: Admins only'
            });
        }

        req.user = user;
        return next();
    } catch (error) {
        return res.status(401).json({
            message: 'Unauthorized',
            error: error.message
        })
    }
}

export default adminAuthorize;
