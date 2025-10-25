import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Username is required"],
        trim: true,
        minLength: 2,
        maxLength: 40,
    },
    email:{
        type: String,
        required: [true, 'User email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: [true, 'User password is required'],
        minLength: 6
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN"],
        default: "USER"
    },
    // email verification
    // isVerified:{
    //     type:Boolean,
    //     default: false
    // },
    // resetPasswordToken: String,
    // resetPasswordExpiresAt: Date,
    // verificationToken: String,
    // verificationTokenExpiresAt: Date
},
{
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
})

const User = mongoose.model("User", userSchema)

export default User;