import prisma from '../lib/prisma';
import { GicListData } from '../types/gic.types';

export const findAllGics = async (): Promise<GicListData[]> => {
    return prisma.gIC.findMany({
        select: {
            id: true,
            nom: true,
        }
    });
};