import jwt from "jsonwebtoken";
import {JWT_SECRET} from "../config/env.js"
import User from "../models/user.model.js"

const adminAuthorize = async (req, res, next) => {
    try {
        let token;
        if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
            token = req.headers.authorization.split(' ')[1]
        }

        if(!token){
            return res.status(401).json({
                message: 'Unauthorized'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET)

        const user = await User.findById(decoded.userId)

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
