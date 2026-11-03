import { Request, Response } from 'express';
import { createOrder, listOrderOffers } from '../../services/order.service.js';
import type { CreateOrderInput } from '../../types/order.types.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export const getOrderOffers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ offers: await listOrderOffers() });
});

export const createBuyerOrder = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (
    idempotencyKey !== undefined &&
    (!idempotencyKey || idempotencyKey.length > 128 || !/^[\w.-]+$/.test(idempotencyKey))
  ) {
    throw badRequest('L’en-tête Idempotency-Key fourni est invalide.');
  }

  const { recolteOffreId, quantity } = req.body ?? {};
  if (
    typeof recolteOffreId !== 'string' ||
    !recolteOffreId.trim() ||
    (typeof quantity !== 'number' && typeof quantity !== 'string') ||
    !/^\d+(\.\d{1,2})?$/.test(String(quantity))
  ) {
    throw badRequest('recolteOffreId et une quantité positive valide sont obligatoires.');
  }

  const input: CreateOrderInput = {
    recolteOffreId: recolteOffreId.trim(),
    quantity: Number(quantity),
  };
  const result = await createOrder(req.user!.id, idempotencyKey ?? undefined, input);
  res.status(result.reused ? 200 : 201).json({ order: result.order });
});
