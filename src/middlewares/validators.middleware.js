import Joi from "joi";

export const validateWithdrawal = async (req, res, next) => {
    const schema = Joi.object({
        userId: Joi.string().uuid().required(),
        phoneNumber: Joi.string()
            .pattern(/^(2547|2541)[0-9]{8}$/)
            .messages({
                'string.pattern.base': 'Phone number must start with 254 followed by 9 digits (e.g., 254712345678).'
            })
            .required(),
        amount: Joi.number().positive().precision(2).min(10).required()
    });
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
};