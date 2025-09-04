import { z } from "zod";
import mongoose, { Schema } from "mongoose";

import { User, Course } from "../models";
import {
  BaseRequest,
  SwapSectionRequest,
  DeadlineExtensionRequest,
} from "../models";

/* schemas and models of basic stuff */
/* TODO: these may not work */
const UserSchema = new Schema(z.toJSONSchema(User)).index(
  { id: 1 },
  { unique: true }
);
const CourseSchema = new Schema(z.toJSONSchema(Course)).index(
  { id: 1 },
  { unique: true }
);
const BaseRequestSchema = new Schema(z.toJSONSchema(BaseRequest), {
  discriminatorKey: "type",
});

export const UserModel = mongoose.model("User", UserSchema);
export const CourseModel = mongoose.model("Course", CourseSchema);
export const BaseRequestModel = mongoose.model(
  "BaseRequest",
  BaseRequestSchema
);

/* schemas and models of actual request types */

const SwapSectionRequestSchema = new Schema(
  z.toJSONSchema(SwapSectionRequest),
  { _id: false }
);
const DeadlineExtensionRequestSchema = new Schema(
  z.toJSONSchema(DeadlineExtensionRequest),
  { _id: false }
);

export const SwapSectionRequestModel = BaseRequestModel.discriminator(
  SwapSectionRequest.type,
  SwapSectionRequestSchema
);
export const DeadlineExtensionRequestModel = BaseRequestModel.discriminator(
  DeadlineExtensionRequest.type,
  DeadlineExtensionRequestSchema
);
