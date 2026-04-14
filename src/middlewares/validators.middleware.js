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
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
};