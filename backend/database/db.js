const mysql = require("mysql2");

const db = mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"Masmoney"
});

db.connect((err)=>{
    
    if(err){
        console.log("Database gagal:", err);
        return;
    }

    console.log("Database terhubung 🚀");
});

module.exports = db;