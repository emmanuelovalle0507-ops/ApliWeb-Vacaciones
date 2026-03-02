import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const createRequestSchema = z
  .object({
    startDate: z.string().min(1, "Fecha de inicio requerida"),
    endDate: z.string().min(1, "Fecha de fin requerida"),
    employeeComment: z.string().max(500, "Máximo 500 caracteres").optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "La fecha de fin no puede ser anterior a la fecha de inicio",
    path: ["endDate"],
  });
export type CreateRequestFormData = z.infer<typeof createRequestSchema>;

export const decisionSchema = z.object({
  comment: z.string().max(500, "Máximo 500 caracteres").optional(),
});
export type DecisionFormData = z.infer<typeof decisionSchema>;
