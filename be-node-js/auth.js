const crypto = require('crypto');

const base64UrlEncode = (value) => Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlDecode = (value) => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
};

const parseExpiresIn = (value) => {
    if (!value) return 7 * 24 * 60 * 60;
    if (/^\d+$/.test(value)) return Number(value);

    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 7 * 24 * 60 * 60;

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers = {
        s: 1,
        m: 60,
        h: 60 * 60,
        d: 24 * 60 * 60,
    };

    return amount * multipliers[unit];
};

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV !== 'test') {
        throw new Error('JWT_SECRET is required');
    }
    return secret || 'test-secret';
};

const sign = (input) => crypto
    .createHmac('sha256', getJwtSecret())
    .update(input)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const generateToken = (user) => {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = parseExpiresIn(process.env.JWT_EXPIRES_IN);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        sub: user._id.toString(),
        username: user.username,
        iat: now,
        exp: now + expiresIn,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const verifyToken = (token) => {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

    if (signature.length !== expectedSignature.length) {
        throw new Error('Invalid token signature');
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        throw new Error('Invalid token signature');
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
        throw new Error('Token expired');
    }

    return payload;
};

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
};

const comparePassword = (password, passwordHash) => {
    const [algorithm, salt, storedHash] = passwordHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !storedHash) {
        return false;
    }

    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    if (hash.length !== storedHash.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
};

module.exports = {
    comparePassword,
    generateToken,
    hashPassword,
    verifyToken,
};
