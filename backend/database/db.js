const mysql = require("mysql2");

const connection = mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"Masmoney"
});

connection.connect((err)=>{
    if(err){
        console.log("Database gagal terhubung");
        console.log(err);
        return;
    }

    console.log("Database terhubung 🚀");
});

module.exports = connection;