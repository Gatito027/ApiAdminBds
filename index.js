require('dotenv').config();
const express = require('express');
//const mongoose = require('./config/database');
const { MongoClient } = require('mongodb');
const app = express();
const port = 3000;
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const path = require('path');
const execPromise = util.promisify(exec);
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
        return res.status(200).json({
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



app.get('/query-collection', async (req, res) => {
    try {
        const { dbName, collectionName } = req.body;

        // Validaciones básicas
        if (!dbName || !collectionName) {
            return res.status(400).json({ 
                error: 'Se requieren los parámetros dbName y collectionName' 
            });
        }

        // Conectar a MongoDB
        const client = new MongoClient(mongoURI);
        await client.connect();
        console.log(`Consultando colección: ${dbName}.${collectionName}`);

        // Obtener referencia a la colección
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Consultar TODOS los documentos sin paginación
        const documents = await collection.find({}).toArray();
        const totalCount = documents.length;

        await client.close();

        return res.status(200).json({
            database: dbName,
            collection: collectionName,
            totalDocuments: totalCount,
            documents: documents
        });

    } catch (error) {
        console.error('Error al consultar la colección:', error);
        
        // Manejo específico de errores
        if (error.message.includes('does not exist') || 
            error.message.includes('ns not found')) {
            return res.status(404).json({ 
                error: 'Base de datos o colección no encontrada' 
            });
        }

        return res.status(500).json({ 
            error: 'Error al consultar la colección',
            details: error.message 
        });
    }
});

app.get('/list-users-collection', async (req, res) => {
    try {
        const client = new MongoClient(mongoURI);
        // Conectar al servidor
        await client.connect();
        console.log('Conectado a MongoDB');
        // Consultar la colección system.users (requiere privilegios)
        const adminDb = client.db('admin');
        const users = await adminDb.collection('system.users').find().toArray();

        // Cerrar la conexión
        await client.close();

        // Responder con la lista de usuarios
        return res.status(200).json(users);
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        return res.status(500).json({ 
            error: 'Error al obtener usuarios', 
            details: error.message,
            note: 'Este endpoint requiere privilegios administrativos'
        });
    }
});

app.post('/create-backup', async (req, res) => {
    const { dbName, backupPath, containerName = 'mongo-contenedor' } = req.body;
    
    if (!dbName || !backupPath) {
        return res.status(400).json({ 
            success: false,
            error: 'PARAMS_MISSING',
            message: 'Se requieren dbName y backupPath'
        });
    }

    try {
        // 1. Verificar que el directorio de backup existe localmente
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        // 2. Crear backup dentro del contenedor
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const containerBackupPath = `${backupPath}/mongo-backup-${timestamp}`;
        
        // Comando para ejecutar mongodump dentro del contenedor
        const dumpCommand = `docker exec ${containerName} mongodump --db ${dbName} --out ${containerBackupPath}`;
        
        // 3. Copiar los archivos del contenedor al host
        //const copyCommand = `docker cp ${containerName}:${containerBackupPath} ${backupPath}`;
        
        // 4. Limpiar el backup temporal dentro del contenedor

        // Ejecutar los comandos en secuencia
        console.log(`Ejecutando backup: ${dumpCommand}`);
        await execPromise(dumpCommand);
        
        /*console.log(`Copiando archivos: ${copyCommand}`);
        await execPromise(copyCommand);*/
        

        return res.status(200).json({
            success: true,
            message: 'Backup creado exitosamente',
            details: {
                dbName,
                backupPath: `${backupPath}/mongo-backup-${timestamp}`,
                containerName,
                commandsExecuted: [dumpCommand]
            }
        });

    } catch (error) {
        console.error('Error en backup:', error);
        return res.status(500).json({
            success: false,
            error: 'BACKUP_FAILED',
            message: 'Error durante el backup',
            details: {
                error: error.stderr || error.message,
                suggestion: 'Verifique: 1) Docker está corriendo, 2) El contenedor existe y está corriendo, 3) MongoDB está activo en el contenedor, 4) Permisos de escritura en el path de backup'
            }
        });
    }
});

app.post('/export-db', async (req, res) => {
    const { dbName, containerName = 'mongo-contenedor' } = req.body;
    
    if (!dbName) {
        return res.status(400).json({ 
            success: false,
            error: 'PARAMS_MISSING',
            message: 'Se requiere dbName'
        });
    }

    try {
        // 1. Preparar nombres de archivos
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportFileName = `${dbName}-export-${timestamp}.json`;
        
        // Ruta dentro del contenedor (usamos /tmp que siempre existe)
        const containerExportPath = `/tmp/${exportFileName}`;
        
        // Ruta en el host
        const hostTempDir = './temp_exports';
        const hostExportPath = `${hostTempDir}/${exportFileName}`;

        // 2. Crear directorio temporal en el host si no existe
        if (!fs.existsSync(hostTempDir)) {
            fs.mkdirSync(hostTempDir, { recursive: true });
        }

        // 3. Ejecutar mongoexport DENTRO del contenedor
        const exportCommand = `docker exec ${containerName} mongoexport --db ${dbName} --collection ${dbName} --out ${containerExportPath}`;
        console.log(`Ejecutando exportación: ${exportCommand}`);
        await execPromise(exportCommand);

        // 4. Copiar archivo DEL contenedor AL host
        const copyCommand = `docker cp ${containerName}:${containerExportPath} ${hostExportPath}`;
        console.log(`Copiando archivo: ${copyCommand}`);
        await execPromise(copyCommand);

        // 5. Limpiar archivo temporal DENTRO del contenedor
        //await execPromise(`docker exec ${containerName} rm ${containerExportPath}`);

        // 6. Verificar que el archivo existe en el host
        if (!fs.existsSync(hostExportPath)) {
            throw new Error('El archivo de exportación no se copió correctamente desde el contenedor');
        }

        // 7. Configurar respuesta para descarga
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${exportFileName}`);
        
        const fileStream = fs.createReadStream(hostExportPath);
        fileStream.pipe(res);
        
        // 8. Limpiar archivo temporal después de enviar
        fileStream.on('end', () => {
            fs.unlink(hostExportPath, (err) => {
                if (err) console.error('Error eliminando archivo temporal:', err);
            });
        });

    } catch (error) {
        console.error('Error detallado en exportación:', {
            message: error.message,
            stack: error.stack,
            stderr: error.stderr,
            stdout: error.stdout
        });
        
        return res.status(500).json({
            success: false,
            error: 'EXPORT_FAILED',
            message: 'Error durante la exportación',
            details: {
                error: error.stderr || error.message,
                suggestion: 'Verifique: 1) El nombre de la colección coincide con la base de datos, 2) MongoDB está corriendo en el contenedor, 3) Hay espacio disponible en /tmp del contenedor'
            }
        });
    }
});

app.post('/import-db', upload.single('backupFile'), async (req, res) => {
    const { dbName, containerName = 'mongo-contenedor', dropExisting = false } = req.body;
    const backupFile = req.file;
    
    if (!dbName || !backupFile) {
        return res.status(400).json({ 
            success: false,
            error: 'PARAMS_MISSING',
            message: 'Se requieren dbName y un archivo de backup'
        });
    }

    try {
        // Directorio temporal para importación
        const tempDir = './temp_imports';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Mover el archivo subido a ubicación conocida
        const tempFilePath = `${tempDir}/${backupFile.originalname}`;
        await fs.promises.rename(backupFile.path, tempFilePath);

        // Copiar archivo al contenedor
        const containerFilePath = `/tmp/${backupFile.originalname}`;
        const copyCommand = `docker cp ${tempFilePath} ${containerName}:${containerFilePath}`;
        await execPromise(copyCommand);

        // Comando para importar
        const dropOption = dropExisting ? '--drop' : '';
        const importCommand = `docker exec ${containerName} mongoimport --db ${dbName} --collection ${dbName} --file ${containerFilePath} ${dropOption}`;
        
        console.log(`Ejecutando importación: ${importCommand}`);
        await execPromise(importCommand);

        // Limpiar archivos temporales
        await Promise.all([
            fs.promises.unlink(tempFilePath),
            execPromise(`docker exec ${containerName} rm ${containerFilePath}`)
        ]);

        return res.status(200).json({
            success: true,
            message: 'Importación completada exitosamente',
            details: {
                dbName,
                fileName: backupFile.originalname,
                fileSize: backupFile.size,
                containerName,
                dropExisting
            }
        });

    } catch (error) {
        console.error('Error en importación:', error);
        return res.status(500).json({
            success: false,
            error: 'IMPORT_FAILED',
            message: 'Error durante la importación',
            details: {
                error: error.stderr || error.message,
                suggestion: 'Verifique: 1) El formato del archivo, 2) Permisos, 3) MongoDB disponible'
            }
        });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
