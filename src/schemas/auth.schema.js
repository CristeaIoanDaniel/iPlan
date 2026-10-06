const { z } = require('zod');
const email= z
.string({required_error :'Email is required'})
.trim()
.email('Invalid email address format');
const password =z
.string({required_error:'Password is required'})
.min(8,'Password must be at least 8 characters long')
.max(100,'Password must not exceed 100 characters')
.regex(/[A-Z]/,'Password must contain at least at least one uppercase letter')
.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
.regex(/[0-9]/, 'Password must contain at least one number');
const registerSchema = z.object({
    body:z.object({
        name:z
        .string({required_error:'Name is required'})
        .trim()
        .min(2,'Name must be at least 2 characters long')
        .max(50,'Name must not exceed 50 characters'),
        email,
        password,
    }),
});
const loginSchema = z.object({
    body:z.object({
        email,
        password:z.string({required_error : 'Password is required'}),
    }),
});
const forgotPasswordSchema = z.object({
    body:z.object({
        email,
    }),
});
const resetPasswordSchema = z.object({
    body:z.object({
        token:z.string({required_error:'Reset token is required'}),
        newPassword:password,
    }),
});

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
};
