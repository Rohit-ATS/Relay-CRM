import { z } from "zod";
export const StepSchema=z.object({delay:z.number().int().min(0).max(30),subject:z.string().min(1).max(120),body:z.string().min(1).max(2000),rationale:z.string().min(1).max(300)});
export const SequenceSchema=z.object({accountId:z.string(),status:z.enum(["draft","approved"]),rationale:z.string(),steps:z.array(StepSchema).min(1).max(5)});
export const InteractionSchema=z.object({accountId:z.string(),text:z.string().min(3).max(3000)});
export const ImportRowSchema=z.object({name:z.string().min(1),title:z.string().optional().default("Contact"),company:z.string().min(1),email:z.string().email(),website:z.string().optional().default(""),notes:z.string().optional().default("")});
