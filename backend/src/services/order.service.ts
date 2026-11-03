import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/index.js';
import prisma from '../lib/prisma.js';
import type { CreateOrderInput, OrderOfferResponse, OrderResponse } from '../types/order.types.js';

function serviceError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function getFingerprint(input: CreateOrderInput): string {
  return createHash('sha256')
    .update(`${input.recolteOffreId}|${new Prisma.Decimal(input.quantity).toString()}`)
    .digest('hex');
}

function toOrderResponse(order: {
  id: string;
  statut: string;
  quantite: Prisma.Decimal;
  prixConvenu: Prisma.Decimal;
  recolteOffre: {
    id: string;
    produitAgricole: { nom: string; unite: string };
    gic: { id: string; nom: string };
  };
}): OrderResponse {
  return {
    id: order.id,
    status: order.statut,
    product: {
      offerId: order.recolteOffre.id,
      name: order.recolteOffre.produitAgricole.nom,
      unit: order.recolteOffre.produitAgricole.unite,
      gicId: order.recolteOffre.gic.id,
      gicName: order.recolteOffre.gic.nom,
    },
    quantity: order.quantite.toString(),
    unitPrice: order.prixConvenu.toString(),
    totalAmount: order.quantite.mul(order.prixConvenu).toString(),
    currency: 'XAF',
  };
}

export async function listOrderOffers(): Promise<OrderOfferResponse[]> {
  const offers = await prisma.recolteOffre.findMany({
    where: { quantiteDisponible: { gt: 0 } },
    include: { produitAgricole: true, gic: true },
    orderBy: { timestampMaj: 'desc' },
  });

  return offers.flatMap((offer) => {
    const unitPrice = offer.produitAgricole.prix;
    if (!unitPrice || !unitPrice.isFinite() || unitPrice.lte(0)) {
      return [];
    }

    return [{
      id: offer.id,
      productName: offer.produitAgricole.nom,
      category: offer.produitAgricole.categorie,
      unit: offer.produitAgricole.unite,
      unitPrice: unitPrice.toString(),
      availableQuantity: offer.quantiteDisponible.toString(),
      currency: 'XAF',
      gic: { id: offer.gic.id, name: offer.gic.nom },
    }];
  });
}

async function findExistingOrder(
  acheteurId: string,
  idempotencyKey: string,
  requestFingerprint: string,
) {
  const existing = await prisma.transactionAcheteur.findUnique({
    where: {
      acheteurId_idempotencyKey: { acheteurId, idempotencyKey },
    },
    include: {
      recolteOffre: {
        include: { produitAgricole: true, gic: true },
      },
    },
  });

  if (existing && existing.requestFingerprint !== requestFingerprint) {
    throw serviceError('Cette clé d’idempotence a déjà été utilisée pour une autre commande.', 409);
  }
  return existing;
}

export async function createOrder(
  acheteurId: string,
  idempotencyKey: string | undefined,
  input: CreateOrderInput,
): Promise<{ order: OrderResponse; reused: boolean }> {
  const buyer = await prisma.acheteur.findUnique({
    where: { id: acheteurId },
    select: { isVerified: true },
  });
  if (!buyer?.isVerified) {
    throw serviceError('Un compte acheteur vérifié est requis pour créer une commande.', 403);
  }

  const quantity = new Prisma.Decimal(input.quantity);
  if (!quantity.isFinite() || quantity.lte(0) || quantity.decimalPlaces() > 2) {
    throw serviceError('La quantité doit être positive et comporter au maximum deux décimales.', 400);
  }

  const requestFingerprint = idempotencyKey ? getFingerprint(input) : undefined;
  if (idempotencyKey && requestFingerprint) {
    const existing = await findExistingOrder(acheteurId, idempotencyKey, requestFingerprint);
    if (existing) {
      return { order: toOrderResponse(existing), reused: true };
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "RecolteOffre"
        WHERE "id" = ${input.recolteOffreId}
        FOR UPDATE
      `;

      const offer = await tx.recolteOffre.findUnique({
        where: { id: input.recolteOffreId },
        include: { produitAgricole: true, gic: true },
      });
      if (!offer) {
        throw serviceError('L’offre de récolte sélectionnée est introuvable.', 404);
      }

      if (quantity.gt(offer.quantiteDisponible)) {
        throw serviceError('La quantité demandée dépasse la quantité actuellement disponible.', 409);
      }

      const unitPrice = offer.produitAgricole.prix;
      if (!unitPrice || !unitPrice.isFinite() || unitPrice.lte(0)) {
        throw serviceError('Le prix de vente de ce produit n’est pas encore configuré.', 409);
      }

      const totalAmount = quantity.mul(unitPrice);
      if (!totalAmount.isInteger() || totalAmount.gt(Number.MAX_SAFE_INTEGER)) {
        throw serviceError('Le total de la commande doit être un montant positif en XAF sans décimales.', 422);
      }

      const created = await tx.transactionAcheteur.create({
        data: {
          type: 'commande_produit',
          quantite: quantity,
          prixConvenu: unitPrice,
          statut: 'en_attente_paiement',
          idempotencyKey: idempotencyKey ?? null,
          requestFingerprint: requestFingerprint ?? null,
          recolteOffreId: offer.id,
          acheteurId,
        },
        include: {
          recolteOffre: {
            include: { produitAgricole: true, gic: true },
          },
        },
      });

      return toOrderResponse(created);
    });

    return { order, reused: false };
  } catch (error) {
    if (idempotencyKey && requestFingerprint) {
      const concurrentOrder = await findExistingOrder(acheteurId, idempotencyKey, requestFingerprint);
      if (concurrentOrder) {
        return { order: toOrderResponse(concurrentOrder), reused: true };
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
      throw serviceError(
        idempotencyKey
          ? 'La base de données est temporairement saturée. Réessayez avec la même clé Idempotency-Key.'
          : 'La base de données est temporairement saturée. Réessayez la création de commande.',
        503,
      );
    }
    throw error;
  }
}
