import { z } from "zod";
import { createRequestType } from "./BaseRequest";

const AppealItem = z.object({
  questionNumber: z.string().min(1).meta({ 
    description: "The question number (e.g., 1a, Q3)." 
  }),
  reason: z.string().min(1).meta({ 
    description: "Reason for this specific question's appeal." 
  }),
});

export const ExaminationAppealMeta = z.object({
  appeals: z.array(AppealItem).min(1).meta({ 
    description: "List of questions to appeal." 
  }),
});

export type ExaminationAppealMeta = z.infer<typeof ExaminationAppealMeta>;

export const ExaminationAppealRequest = createRequestType(
  "Examination Appeal",
  ExaminationAppealMeta,
).meta({
  title: "Examination Appeal",
  description: "Request an appeal for specific examination questions",
});
export type ExaminationRequest = z.infer<typeof ExaminationAppealRequest>;
