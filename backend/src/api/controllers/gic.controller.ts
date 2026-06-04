import { Request, Response } from 'express';
import * as gicService from '../../services/gic.service';

export const listGics = async (req: Request, res: Response) => {
    const gics = await gicService.findAllGics();
    res.status(200).json(gics);
};