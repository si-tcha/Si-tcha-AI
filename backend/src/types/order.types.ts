export type CreateOrderInput = {
  recolteOffreId: string;
  quantity: number;
};

export type OrderResponse = {
  id: string;
  status: string;
  product: {
    offerId: string;
    name: string;
    unit: string;
    gicId: string;
    gicName: string;
  };
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  currency: 'XAF';
};

export type OrderOfferResponse = {
  id: string;
  productName: string;
  category: string;
  unit: string;
  unitPrice: string;
  availableQuantity: string;
  currency: 'XAF';
  gic: {
    id: string;
    name: string;
  };
};
