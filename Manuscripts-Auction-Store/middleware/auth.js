function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return next();
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userRole) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  authorizeRoles,
};
