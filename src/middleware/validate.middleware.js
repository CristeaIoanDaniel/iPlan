const AppError = require('../utils/AppError');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const formattedErrors = result.error.issues.map((err) => ({
      field: err.path.join('.').replace(/^(body|query|params)\./, ''),
      message: err.message,
    }));

    return next(new AppError('Validation failed', 400, formattedErrors));
  }
  if(result.data.body ) req.body= result.data.body;
  if(result.data.query) req.query=result.data.query;
  if(result.data.params) req.params=result.data.params;
  next();
};
module.exports=validate;