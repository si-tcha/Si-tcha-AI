import prisma from '../lib/prisma';
// GET /b2b/offers — Public (acheteurs + vendeurs voient toutes les offres)
export async function getB2BOffers(_req, res) {
    try {
        const offers = await prisma.b2BOfferEntry.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return res.json({
            offers: offers.map((o) => ({
                id: o.id,
                title: o.title,
                type: o.type,
                category: o.category,
                priceOrExchange: o.priceOrExchange,
                gicName: o.gicName,
                location: o.location,
                contact: o.contact,
                createdAt: o.createdAt.toISOString(),
            })),
        });
    }
    catch (err) {
        console.error('Erreur getB2BOffers:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
}
// POST /b2b/offers — Auth seller uniquement
export async function createB2BOffer(req, res) {
    if (req.user?.role !== 'seller' || !req.user.gicId) {
        return res.status(403).json({ message: 'Accès GIC requis.' });
    }
    const { title, type, category, priceOrExchange, gicName, location, contact } = req.body;
    if (!title?.trim() || !type?.trim() || !priceOrExchange?.trim()) {
        return res.status(400).json({ message: 'Titre, type et tarif/échange sont requis.' });
    }
    try {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const offer = await prisma.b2BOfferEntry.create({
            data: {
                id,
                title: title.trim(),
                type: type.trim(),
                category: category?.trim() ?? '',
                priceOrExchange: priceOrExchange.trim(),
                gicName: gicName?.trim() ?? '',
                location: location?.trim() ?? '',
                contact: contact?.trim() ?? '',
                gicId: BigInt(req.user.gicId),
            },
        });
        return res.status(201).json({
            offer: {
                id: offer.id,
                title: offer.title,
                type: offer.type,
                category: offer.category,
                priceOrExchange: offer.priceOrExchange,
                gicName: offer.gicName,
                location: offer.location,
                contact: offer.contact,
                createdAt: offer.createdAt.toISOString(),
            },
        });
    }
    catch (err) {
        console.error('Erreur createB2BOffer:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
}
