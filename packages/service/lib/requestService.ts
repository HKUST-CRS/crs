import {
  RequestModel,
  SwapSectionRequestModel,
  DeadlineExtensionRequestModel,
} from "../schemas/request";
import type {
  IBaseRequest,
  ISwapSectionRequest,
  IDeadlineExtensionRequest,
  IRequestDetails,
  IResponse,
} from "../schemas/request";
import { REQUEST_TYPES, type RequestTypeValue } from "../models/requests/types";

export class RequestService {
  /**
   * Create a swap section request
   */
  async createSwapSectionRequest(requestData: {
    studentId: string;
    courseId: { code: string; semester: string };
    metadata: {
      fromSection: string;
      fromDate: Date;
      toSection: string;
      toDate: Date;
    };
    details: IRequestDetails;
  }): Promise<ISwapSectionRequest> {
    const request = new SwapSectionRequestModel({
      type: REQUEST_TYPES.SWAP_SECTION,
      ...requestData,
      timestamp: new Date(),
    });
    return (await request.save()) as ISwapSectionRequest;
  }

  /**
   * Create a deadline extension request
   */
  async createDeadlineExtensionRequest(requestData: {
    studentId: string;
    courseId: { code: string; semester: string };
    metadata: {
      assignmentName: string;
      requestedDeadline: Date;
    };
    details: IRequestDetails;
  }): Promise<IDeadlineExtensionRequest> {
    const request = new DeadlineExtensionRequestModel({
      type: REQUEST_TYPES.DEADLINE_EXTENSION,
      ...requestData,
      timestamp: new Date(),
    });
    return (await request.save()) as IDeadlineExtensionRequest;
  }

  /**
   * Find a request by its ID
   */
  async findRequestById(id: string): Promise<IBaseRequest | null> {
    return await RequestModel.findById(id);
  }

  /**
   * Get all requests for a specific student
   */
  async getRequestsByStudent(studentId: string): Promise<IBaseRequest[]> {
    return await RequestModel.find({ studentId }).sort({ timestamp: -1 });
  }

  /**
   * Get all requests for a specific course
   */
  async getRequestsByCourse(
    code: string,
    semester: string
  ): Promise<IBaseRequest[]> {
    return await RequestModel.find({
      "courseId.code": code,
      "courseId.semester": semester,
    }).sort({ timestamp: -1 });
  }

  /**
   * Get all pending requests (without response)
   */
  async getPendingRequests(): Promise<IBaseRequest[]> {
    return await RequestModel.find({ response: null }).sort({ timestamp: 1 });
  }

  /**
   * Respond to a request (approve or reject)
   */
  async respondToRequest(
    requestId: string,
    response: {
      instructorId: string;
      approved: boolean;
      remark: string;
    }
  ): Promise<IBaseRequest | null> {
    return await RequestModel.findByIdAndUpdate(
      requestId,
      {
        response: {
          ...response,
          timestamp: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Get requests by type
   */
  async getRequestsByType(type: RequestTypeValue): Promise<IBaseRequest[]> {
    return await RequestModel.find({ type }).sort({ timestamp: -1 });
  }

  /**
   * Delete a request by ID
   */
  async deleteRequest(requestId: string): Promise<boolean> {
    const result = await RequestModel.deleteOne({ _id: requestId });
    return result.deletedCount > 0;
  }
}
