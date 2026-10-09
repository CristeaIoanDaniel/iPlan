const { promisify } = require('node:util');
const {
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require('node:crypto');
const pool = require('../../config/db');
const { generateToken } = require('../middleware/auth.middleware');

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, PASSWORD_KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
};

const verifyPassword = async (password, storedHash) => {
  const [algorithm, saltHex, keyHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(keyHex, 'hex');
  if (salt.length !== 16 || expectedKey.length !== PASSWORD_KEY_LENGTH) {
    return false;
  }

  const actualKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH);
  return timingSafeEqual(actualKey, expectedKey);
};

const register = async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email.toLowerCase();
    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role`,
      [name, email, passwordHash],
    );
    const user = rows[0];
    const token = generateToken(user);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: { user, token },
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'fail',
        message: 'An account with this email already exists',
      });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const email = req.body.email.toLowerCase();
    const { rows } = await pool.query(
      `SELECT id, name, email, role, password_hash
       FROM users
       WHERE email = $1`,
      [email],
    );
    const [storedUser] = rows;
    if (!storedUser || !(await verifyPassword(password, storedUser.password_hash))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password',
      });
    }

    const user = {
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email,
      role: storedUser.role,
    };
    const token = generateToken(user);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  hashPassword,
  verifyPassword,
};