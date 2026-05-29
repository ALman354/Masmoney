const express = require("express");
const cors = require("cors");

const db = require("./database/db");

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const transaksiRoute=
require("./routes/transaksi")

app.use(
    "/transaksi",
    transaksiRoute
)

// route test
app.get("/", (req,res)=>{
    res.json({
        status:"success",
        message:"API Finance berjalan 🚀"
    });
});



// tambah transaksi
app.post("/transaksi", (req,res)=>{

    const {tipe, nominal, keterangan} = req.body;

    const sql = `
    INSERT INTO transaksi
    (tipe, nominal, keterangan)
    VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [tipe, nominal, keterangan],
        (err,result)=>{

            if(err){
                return res.status(500).json({
                    status:"error",
                    message:err.message
                });
            }

            res.json({
                status:"success",
                message:"Transaksi berhasil ditambah"
            });

        }
    );

});

// ambil semua transaksi
app.get("/transaksi",(req,res)=>{

    const sql="SELECT * FROM transaksi ORDER BY id DESC";

    db.query(sql,(err,result)=>{

        if(err){
            return res.status(500).json({
                status:"error",
                message:err.message
            });
        }

        res.json(result);

    });

});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>{
    console.log(`Server berjalan di port ${PORT}`);

});
