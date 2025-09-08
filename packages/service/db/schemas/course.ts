import mongoose, { Schema, Document } from "mongoose";

export interface ICourse extends Document {
  code: string;
  semester: string;
  title: string;
  people: Map<string, "student" | "instructor" | "ta">;
  requestTypesEnabled: Map<string, boolean>;
}

const CourseSchema = new Schema<ICourse>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    semester: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    people: {
      type: Map,
      of: {
        type: String,
        enum: ["student", "instructor", "ta"],
      },
      default: new Map(),
    },
    requestTypesEnabled: {
      type: Map,
      of: Boolean,
      default: new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CourseSchema.index({ code: 1, semester: 1 }, { unique: true });

export const CourseModel = mongoose.model<ICourse>("Course", CourseSchema);
