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

// Ruta para crear roles con permisos
app.post('/create-role', async (req, res) => {
    try {
        const { roleName, dbName, permissions } = req.body;
        
        // Validación de los datos de entrada
        if (!roleName || !dbName || !permissions) {
            return res.status(400).json({ 
                error: 'El nombre del rol, la base de datos y los permisos son requeridos' 
            });
        }
        // Validar que los permisos sean un array válido
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return res.status(400).json({ 
                error: 'Los permisos deben ser un array no vacío' 
            });
        }
        // Conectar al cliente de MongoDB
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log('Conectado a MongoDB');
        // Usar la base de datos admin para crear roles (recomendado)
        const adminDb = client.db('admin');
        // Crear el rol en MongoDB
        await adminDb.command({
            createRole: roleName,
            privileges: permissions.map(perm => ({
                resource: { db: dbName, collection: perm.collection || '' },
                actions: perm.actions
            })),
            roles: []
        });
        console.log(`Rol de MongoDB creado: ${roleName} con permisos en: ${dbName}`);
        await client.close();
        return res.status(200).json({ 
            message: `Rol ${roleName} creado con éxito en MongoDB`, 
            role: {
                roleName,
                dbName,
                permissions
            }
        });
    } catch (error) {
        console.error('Error al crear el rol:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

app.get('/list-roles', async (req, res) => {
    try {
        // Conectar al cliente de MongoDB
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log('Conectado a MongoDB');

        // Usar la base de datos admin para consultar roles
        const adminDb = client.db('admin');

        // Obtener todos los roles (personalizados y del sistema)
        const roles = await adminDb.command({
            rolesInfo: 1,
            showPrivileges: true,
            showBuiltinRoles: true // Incluir roles predefinidos
        });

        // Formatear la respuesta para mayor claridad
        const formattedRoles = roles.roles.map(role => ({
            roleName: role.role,
            database: role.db,
            isBuiltin: role.isBuiltin || false, // Indicador de rol del sistema
            privileges: role.privileges,
            inheritedRoles: role.roles
        }));

        await client.close();
        return res.status(200).json(formattedRoles);
    } catch (error) {
        console.error('Error al listar los roles:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

app.get('/list-collections', async (req, res) => {
    try {
        const { dbName } = req.body;

        // Validar que se proporcionó el nombre de la base de datos
        if (!dbName) {
            return res.status(400).json({ error: 'El nombre de la base de datos es requerido' });
        }

        // Conectar al cliente de MongoDB
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log(`Conectado a MongoDB para listar colecciones de ${dbName}`);

        // Obtener referencia a la base de datos
        const db = client.db(dbName);

        // Listar todas las colecciones con información básica
        const collections = await db.listCollections().toArray();

        // Formatear la respuesta
        const formattedCollections = collections.map(collection => ({
            name: collection.name,
            type: collection.type || 'collection',
            options: collection.options || {}
        }));

        await client.close();
        return res.status(200).json({
            database: dbName,
            collections: formattedCollections,
            count: collections.length
        });
    } catch (error) {
        console.error('Error al listar las colecciones:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

app.post('/create-user', async (req, res) => {
    try {
        const { username, password, roles, dbName } = req.body;

        // Validaciones básicas
        if (!dbName || !username || !password) {
            return res.status(400).json({
                error: 'Nombre de base de datos, usuario y contraseña son requeridos'
            });
        }

        // Roles por defecto si no se especifican
        const userRoles = roles && Array.isArray(roles) && roles.length > 0
            ? roles
            : [{ role: "readWrite", db: dbName }]; // Rol por defecto

        // Conectar a MongoDB
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log(`Conectado a MongoDB para crear usuario en ${dbName}`);

        // Referencia a la base de datos especificada
        const targetDb = client.db(dbName);

        // Crear el usuario utilizando db.command()
        const result = await targetDb.command({
            createUser: username,
            pwd: password,
            roles: userRoles.map(role => ({
                role: role.name,
                db: role.db || dbName // Usa la base de datos objetivo como predeterminada
            }))
        });

        console.log(`Usuario ${username} creado en ${dbName} con roles:`, userRoles);

        await client.close();
        return res.status(201).json({
            message: `Usuario creado exitosamente en ${dbName}`,
            user: {
                username,
                database: dbName,
                roles: userRoles,
                createdAt: new Date()
            }
        });
    } catch (error) {
        console.error('Error al crear usuario:', error);

        // Manejo específico de errores
        let statusCode = 500;
        let errorMessage = 'Error interno del servidor';

        if (error.message.includes('already exists')) {
            statusCode = 409;
            errorMessage = 'El nombre de usuario ya existe en esta base de datos';
        } else if (error.message.includes('Role')) {
            statusCode = 400;
            errorMessage = 'Uno o más roles especificados no existen';
        }

        return res.status(statusCode).json({
            error: errorMessage,
            details: error.message
        });
    }
});


app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
