const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketAuth = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: no token'));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).lean();

    if (!user) {
      return next(new Error('Authentication error: user not found'));
    }

    if (user.socketId !== null) {
      return next(new Error('Already logged in from another tab'));
    }

    socket.username = payload.username;   // replaces raw client arg
    socket.userId   = payload.userId;
    next();
  } catch (error) {
    if (error.message === 'Already logged in from another tab') {
      return next(error);
    }
    next(new Error('Authentication error: invalid token'));
  }
};

module.exports = socketAuth;
