import { Request, Response, NextFunction } from 'express';

export const validate = (requiredFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const missingFields: string[] = [];
        for (const field of requiredFields) {
            if (!req.body[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Les champs suivants sont manquants ou vides : ${missingFields.join(', ')}.`
            });
        }

        next();
    };
};