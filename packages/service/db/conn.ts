import mongoose from "mongoose";

export async function connectDB() {
    try {
        const mongodbString = process.env.MONGODB_STRING;
        if (!mongodbString) {
            throw new Error('MONGODB_STRING environment variable is not set');
        }
        await mongoose.connect(mongodbString);
    } catch (err: any) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}
