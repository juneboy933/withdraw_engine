import dotenv from 'dotenv';

dotenv.config();

export const env = process.env;
export const isDevelopment = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

export const defaultMpesaWhitelist = [
    '196.201.214.200',
    '196.201.214.206',
    '196.201.213.114',
    '196.201.214.207',
    '196.201.214.208',
    '196.50.137.33'
];
