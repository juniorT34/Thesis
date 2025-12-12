import mongoose from "mongoose";
import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import CustomError from "../utils/CustomError.js";
import logger from "../utils/logger.js";
// import { generateVerificationCode } from "../utils/generateVerificationCode.js";

export const signUp = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      const error = new Error("All fields are required !");
      error.statusCode = 400;
      throw error;
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      const error = new Error("User already exists");
      error.statusCode = 409;
      throw error;
    }

    //hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // add email verification functionality 
    // const verificationToken = generateVerificationCode();

    const newUser = await User.create(
      [{ name, email, password: hashedPassword}],
      { session }
    );

    const token = jwt.sign({ userId: newUser[0]._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    await session.commitTransaction();
    session.endSession();

    logger.info(`User ${newUser[0].name} (${newUser[0].email}) registered successfully`);

    res.status(201).json({
      success: true,
      message: `User ${newUser[0].name} created successfully`,
      data: {
        token,
        user: {
          id: newUser[0]._id,
          name: newUser[0].name,
          email: newUser[0].email,
          // role is to be removed(only here for testing purposes)
          role: newUser[0].role,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Failed login attempt for non-existent user: ${email}`);
      throw new CustomError("Invalid email or password", 400);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for user: ${email} - invalid password`);
      throw new CustomError("Invalid email or password", 400);
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    logger.info(`User ${user.name} (${user.email}) logged in successfully`);

    res.status(200).json({
      status: true,
      message: `${user.name} Logged in successfully `,
      data: {
        token,
        user: {
          id: user._id,
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

/*
Atomic operations,
database operations that update the state are atomic. All or nothing
Insert either works completely or it doesn't
Update either works completely or it doesn't
You never get half an operation
*/
