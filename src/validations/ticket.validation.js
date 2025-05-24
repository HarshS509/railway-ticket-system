const Joi = require("joi");
const httpError = require("../utils/http-error.util");
const { HTTP_STATUS_CODES } = require("../config/const.config");

// Validation schemas
const schemas = {
  bookTicket: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name cannot exceed 100 characters",
      "any.required": "Name is required",
    }),
    age: Joi.number().integer().min(0).max(120).required().messages({
      "number.base": "Age must be a number",
      "number.integer": "Age must be an integer",
      "number.min": "Age cannot be negative",
      "number.max": "Age cannot exceed 120",
      "any.required": "Age is required",
    }),
    gender: Joi.string().valid("M", "F", "O").required().messages({
      "string.empty": "Gender is required",
      "any.only": "Gender must be M, F, or O",
      "any.required": "Gender is required",
    }),
    isMotherWithChildren: Joi.boolean().default(false).messages({
      "boolean.base": "isMotherWithChildren must be a boolean",
    }),
    children: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().min(2).max(100).required().messages({
            "string.empty": "Child's name is required",
            "string.min": "Name must be at least 2 characters long",
            "string.max": "Name cannot exceed 100 characters",
            "any.required": "Child's name is required",
          }),
          age: Joi.number().integer().min(0).max(17).required().messages({
            "number.base": "Age must be a number",
            "number.integer": "Age must be an integer",
            "number.min": "Age cannot be negative",
            "number.max": "Child must be under 18 years old",
            "any.required": "Age is required",
          }),
          gender: Joi.string().valid("M", "F", "O").required().messages({
            "string.empty": "Gender is required",
            "any.only": "Gender must be M, F, or O",
            "any.required": "Gender is required",
          }),
        })
      )
      .when("isMotherWithChildren", {
        is: true,
        then: Joi.array().min(1).max(4).required().messages({
          "array.min":
            "At least one child is required when booking as mother with children",
          "array.max": "Maximum 4 children allowed",
          "any.required":
            "Children array is required when booking as mother with children",
        }),
        otherwise: Joi.array().max(0).messages({
          "array.max":
            "Children array should not be provided for individual bookings",
        }),
      }),
  }).custom((obj, helpers) => {
    if (obj.isMotherWithChildren) {
      if (obj.gender !== "F") {
        return helpers.error("any.invalid", {
          message: "Only female passengers can book with children",
        });
      }
      if (obj.age < 18) {
        return helpers.error("any.invalid", {
          message:
            "When booking as mother with children, the mother must be at least 18 years old. Please book as a regular passenger instead.",
        });
      }
      if (obj.children && obj.children.some((child) => child.age >= obj.age)) {
        return helpers.error("any.invalid", {
          message:
            "Children's age cannot be greater than or equal to the mother's age",
        });
      }
    }
    return obj;
  }),

  cancelTicket: Joi.object({
    ticketId: Joi.number().integer().positive().required().messages({
      "number.base": "Ticket ID must be a number",
      "number.integer": "Ticket ID must be an integer",
      "number.positive": "Ticket ID must be positive",
      "any.required": "Ticket ID is required",
    }),
  }),
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(httpError(errorMessage, HTTP_STATUS_CODES.BAD_REQUEST));
    }

    next();
  };
};

// Validate params middleware
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(httpError(errorMessage, HTTP_STATUS_CODES.BAD_REQUEST));
    }

    next();
  };
};

module.exports = {
  schemas,
  validate,
  validateParams,
};
