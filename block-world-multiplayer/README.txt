BLOCK WORLD MULTIPLAYER
=======================

VERSIÓN DE PRUEBA

Incluye:
- Login con nombre y contraseña.
- Contraseña validada por el servidor.
- Multijugador básico en tiempo real.
- Movimiento de jugadores sincronizado.
- Otros jugadores visibles.
- Romper bloques sincronizado.
- Colocar bloques sincronizado.
- Chat.
- Lista de jugadores conectados.
- Mundo compartido mientras el servidor está encendido.

CONTRASEÑA DE PRUEBA
--------------------
apolo123

Puedes cambiarla en server.js:

const GAME_PASSWORD = process.env.GAME_PASSWORD || 'apolo123';

REQUISITOS
----------
Debes tener Node.js instalado.

Descarga:
https://nodejs.org/

CÓMO PROBARLO
-------------
1. Descomprime block-world-multiplayer.zip

2. Abre una terminal dentro de la carpeta:

block-world-multiplayer

3. Ejecuta:

npm install

4. Cuando termine ejecuta:

npm start

5. Abre en tu navegador:

http://localhost:3000

PRUEBA MULTIJUGADOR EN UNA MISMA PC
-----------------------------------
Abre:

http://localhost:3000

en dos ventanas diferentes.

Entra con dos nombres diferentes.

Ejemplo:

Ventana 1:
Nombre: Jose
Contraseña: apolo123

Ventana 2:
Nombre: Carlos
Contraseña: apolo123

Ambos jugadores aparecerán en el mismo mundo.

PRUEBA EN DOS COMPUTADORAS DE TU RED
------------------------------------
Si ambas PCs están conectadas al mismo Wi-Fi o red:

1. En la PC que ejecuta el servidor, abre CMD y escribe:

ipconfig

2. Busca "Dirección IPv4".

Ejemplo:

192.168.1.15

3. En la otra computadora abre:

http://192.168.1.15:3000

Puede ser necesario permitir Node.js en el Firewall de Windows.

IMPORTANTE PARA PUBLICAR EN INTERNET
------------------------------------
Esta versión necesita un hosting que permita Node.js.

No funciona como multijugador real si únicamente subes los archivos a un hosting
estático de HTML/CSS/JS.

Para producción conviene agregar:
- Base de datos.
- Usuarios individuales.
- Contraseñas cifradas.
- Persistencia permanente del mundo.
- HTTPS.
- Anti-spam.
- Sistema de salas.
- Optimización por chunks.
