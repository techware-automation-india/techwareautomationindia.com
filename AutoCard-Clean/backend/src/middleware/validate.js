export const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        message: errors[0]?.message || "Validation failed.",
        field: errors[0]?.field,
        errors,
      });
    }

    req.body = result.data;

    next();
  };
};
