import { Errors } from '../utils/HttpError.js';

export function validate(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const details = result.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
            }));
            return next(Errors.ValidationError('Validation failed', details));
        }
        req.validated = result.data;
        next();
    };
}
