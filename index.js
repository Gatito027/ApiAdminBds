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

app.post('/create-db', async (req, res) => {
    try {
        const { dbName } = req.body; // Obtener el nombre de la base de datos desde el cuerpo de la solicitud
        if (!dbName) {
            return res.status(400).json({ error: 'El nombre de la base de datos es requerido' });
        }
        // Conectar al cliente de MongoDB
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log('Conectado a MongoDB');
        // Crear una colección inicial para activar la creación de la base de datos
        const db = client.db(dbName);
        await db.createCollection('default_collection');
        console.log(`Base de datos creada: ${dbName}`);
        await client.close();
        return res.status(200).json({ message: `Base de datos ${dbName} creada con éxito` });
    } catch (error) {
        console.error('Error al crear la base de datos:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/delete-db', async (req, res) => {
    try {
        const { dbName } = req.body; // Recibe el nombre de la base de datos desde la solicitud
        if (!dbName) {
            return res.status(400).json({ error: 'El nombre de la base de datos es requerido' });
        }
        // Conectar al cliente de MongoDB
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log('Conectado a MongoDB');
        // Obtener la base de datos y eliminarla
        const db = client.db(dbName);
        await db.dropDatabase();
        console.log(`Base de datos eliminada: ${dbName}`);
        await client.close();
        return res.status(200).json({ message: `Base de datos ${dbName} eliminada exitosamente` });
    } catch (error) {
        console.error('Error al eliminar la base de datos:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
