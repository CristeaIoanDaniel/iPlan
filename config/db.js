require ('dotenv').config();
const {Pool}=require('pg');
const pool= new Pool({
    user:process.env.DB_USER || 'name_of_your_user',
    host:process.env.DB_HOST||'localhost',
    database:process.env.DB_NAME||'name_of_your_database',
    password: process.env.DB_PASSWORD,
    port:Number(process.env.DB_PORT) ||5432,
});
module.exports=pool;