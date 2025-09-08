import mongoose, { Schema, Document } from "mongoose";
import {
  ALL_REQUEST_TYPES,
  REQUEST_TYPES,
  type RequestTypeValue,
} from "../../models/requests/types";

export interface IFileReference {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface IRequestDetails {
  reason: string;
  proof: IFileReference[];
}

export interface IResponse {
  instructorId: string;
  timestamp: Date;
  approved: boolean;
  remark: string;
}

export interface IBaseRequest extends Document {
  type: RequestTypeValue;
  studentId: string;
  courseId: {
    code: string;
    semester: string;
  };
  timestamp: Date;
  metadata: Record<string, any>;
  details: IRequestDetails;
  response?: IResponse;
}

const FileReferenceSchema = new Schema<IFileReference>(
  {
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: {
      type: Number,
      required: true,
      max: [5 * 1024 * 1024, "File size cannot exceed 5MB"],
    },
    buffer: { type: Buffer, required: true },
  },
  { _id: false }
);

const RequestDetailsSchema = new Schema<IRequestDetails>(
  {
    reason: { type: String, required: true },
    proof: [FileReferenceSchema],
  },
  { _id: false }
);

const ResponseSchema = new Schema<IResponse>(
  {
    instructorId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    approved: { type: Boolean, required: true },
    remark: { type: String, required: true },
  },
  { _id: false }
);

const BaseRequestSchema = new Schema<IBaseRequest>(
  {
    type: {
      type: String,
      required: true,
      enum: ALL_REQUEST_TYPES,
    },
    studentId: { type: String, required: true },
    courseId: {
      code: { type: String, required: true },
      semester: { type: String, required: true },
    },
    timestamp: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed, required: true },
    details: { type: RequestDetailsSchema, required: true },
    response: { type: ResponseSchema, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    discriminatorKey: "type",
  }
);

// Create indexes for better query performance
BaseRequestSchema.index({ studentId: 1, timestamp: -1 });
BaseRequestSchema.index({ "courseId.code": 1, "courseId.semester": 1 });

export const RequestModel = mongoose.model<IBaseRequest>(
  "Request",
  BaseRequestSchema
);

// Discriminator interfaces for specific request types
export interface ISwapSectionRequest extends IBaseRequest {
  type: typeof REQUEST_TYPES.SWAP_SECTION;
  metadata: {
    fromSection: string;
    fromDate: Date;
    toSection: string;
    toDate: Date;
  };
}

export interface IDeadlineExtensionRequest extends IBaseRequest {
  type: typeof REQUEST_TYPES.DEADLINE_EXTENSION;
  metadata: {
    assignmentName: string;
    requestedDeadline: Date;
  };
}

// Create discriminators for each request type
export const SwapSectionRequestModel =
  RequestModel.discriminator<ISwapSectionRequest>(
    REQUEST_TYPES.SWAP_SECTION,
    new Schema({
      metadata: {
        fromSection: { type: String, required: true },
        fromDate: { type: Date, required: true },
        toSection: { type: String, required: true },
        toDate: { type: Date, required: true },
      },
    })
  );

export const DeadlineExtensionRequestModel =
  RequestModel.discriminator<IDeadlineExtensionRequest>(
    REQUEST_TYPES.DEADLINE_EXTENSION,
    new Schema({
      metadata: {
        assignmentName: { type: String, required: true },
        requestedDeadline: { type: Date, required: true },
      },
    })
  );
