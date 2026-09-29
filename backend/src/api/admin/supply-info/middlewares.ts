import { validateAndTransformBody } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { AdminUpsertSupplyInfo } from "./validators";

export const adminSupplyInfoMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/supply-info/:variant_id",
    middlewares: [validateAndTransformBody(AdminUpsertSupplyInfo)],
  },
];
