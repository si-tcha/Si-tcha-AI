import { Request, Response } from 'express';

export const getHealthStatus = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
};