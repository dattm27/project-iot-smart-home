const { verifyToken } = require('../auth');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Cần đăng nhập để sử dụng API' });
    }

    try {
        req.user = verifyToken(token);
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
};

module.exports = authenticateToken;
