const { generateToken } = require('../middleware/auth.middleware');

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body; 
    const newUser = { id: 'usr_' + Date.now(), name, email, role: 'user' };

    const token = generateToken(newUser);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: { user: newUser, token },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = { id: 'usr_12345', email, role: 'user' };
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
};