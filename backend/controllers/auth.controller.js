import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import CustomError from "../utils/CustomError.js";
import logger from "../utils/logger.js";
import { 
  createUser, 
  findUserByEmail, 
  findUserWithPasswordByEmail 
} from "../repositories/user.repository.js";
// import { generateVerificationCode } from "../utils/generateVerificationCode.js";

export const signUp = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      const error = new Error("All fields are required !");
      error.statusCode = 400;
      throw error;
    }

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      const error = new Error("User already exists");
      error.statusCode = 409;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const createdUser = await createUser({ name, email, password: hashedPassword });

    const token = jwt.sign({ userId: createdUser.id, role: createdUser.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    logger.info(`User ${createdUser.name} (${createdUser.email}) registered successfully`);

    res.status(201).json({
      success: true,
      message: `User ${createdUser.name} created successfully`,
      data: {
        token,
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
        },
      },
    });
  } catch (error) {
    logger.error(`User registration failed: ${error.message}`);
    next(error);
  }
};

export const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error("All fields are required !");
      error.statusCode = 400;
      throw error;
    }

    const user = await findUserWithPasswordByEmail(email);
    if (!user) {
      logger.warn(`Failed login attempt for non-existent user: ${email}`);
      throw new CustomError("Invalid email or password", 400);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for user: ${email} - invalid password`);
      throw new CustomError("Invalid email or password", 400);
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    logger.info(`User ${user.name} (${user.email}) logged in successfully`);

    res.status(200).json({
      success: true,
      message: `${user.name} Logged in successfully`,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

export const signOut = async (req, res, next) => {
  try {
    // For stateless JWT, sign out is handled on the client by deleting the token
    logger.info(`User signed out successfully`);
    res.status(200).json({
      success: true,
      message:
        "Signed out successfully. Please remove the token from your client.",
    });
  } catch (error) {
    logger.error(`Sign out error: ${error.message}`);
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          createdAt: req.user.createdAt,
          updatedAt: req.user.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error(`Failed to fetch profile: ${error.message}`);
    next(error);
  }
};

/*
Atomic operations,
database operations that update the state are atomic. All or nothing
Insert either works completely or it doesn't
Update either works completely or it doesn't
You never get half an operation
*/
