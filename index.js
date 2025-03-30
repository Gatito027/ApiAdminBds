require('dotenv').config();
const express = require('express');
//const mongoose = require('./config/database');
const { MongoClient } = require('mongodb');
const app = express();
const port = 3000;
app.use(express.json());
const mongoURI = process.env.MONGO_URI; // URL de tu servidor MongoDB

app.get('/', (req, res) => {
    res.send('¡Hola, mundo!');
});

app.post('/create-db', async (req, res) => {
    try {
        const { nombre } = req.body; 
        if (!nombre) {
            return res.status(400).json({ error: 'Nombre es requerido' });
        }
        //*Logica

        return res.status(200).json({ nombre });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error Interno' });
    }
});

app.get('/list-dbs', async (req, res) => {
    try {
        const client = new MongoClient(mongoURI);

        // Conectar al servidor
        await client.connect();
        console.log('Conectado a MongoDB');

        // Obtener la lista de bases de datos
        const admin = client.db().admin();
        const databases = await admin.listDatabases();

        // Filtrar las bases de datos del sistema
        const userDatabases = databases.databases.filter(db => !['admin', 'config', 'local'].includes(db.name));

        // Cerrar la conexión
        await client.close();

        // Responder con la lista de bases de datos creadas por el usuario
        return res.status(200).json(userDatabases);
    } catch (error) {
        console.error('Error al listar bases de datos:', error);
        return res.status(500).json({ error: 'Error al obtener bases de datos' });
    }
});




app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
