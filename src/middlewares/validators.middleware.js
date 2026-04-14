import Joi from "joi";

export const validateWithdrawal = async (req, res, next) => {
    const schema = Joi.object({
        phoneNumber: Joi.string()
            .pattern(/^(?:\+?254)(?:7|1)[0-9]{8}$/)
            .messages({
                'string.pattern.base': 'Phone number must use the Kenyan international format (e.g. +254712345678 or 254712345678).'
            })
            .required(),
        amount: Joi.number().positive().precision(2).min(10).required()
    });

    const headersSchema = Joi.object({
        'idempotency-key': Joi.string().uuid().required()
    }).unknown(true);

    const { error: bodyError } = schema.validate(req.body);
    if (bodyError) return res.status(400).json({ error: bodyError.details[0].message });

    const { error: headerError } = headersSchema.validate(req.headers);
    if (headerError) return res.status(400).json({ error: 'Idempotency-Key header is required and must be a valid UUID.' });

    next();
};