# Adberry Signals 🚀

Plataforma profesional de trading automatizado para copiar señales de Telegram y TradingView.

## 🛠️ Instalación Local

1. **Descarga el código** y abre la carpeta en Visual Studio Code.
2. **Instala las dependencias**:
   ```bash
   npm install
   ```
3. **Inicia la aplicación**:
   ```bash
   npm run dev
   ```
4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 🌐 Subir a GitHub (Pasos Simples)

1. Crea un nuevo repositorio **Privado** en GitHub llamado `adberry-signals`.
2. En la terminal de VS Code, pega estos comandos uno por uno:
   ```bash
   git init
   git add .
   git commit -m "Primer despliegue"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/adberry-signals.git
   git push -u origin main
   ```
   *(Cambia `TU_USUARIO` por tu nombre de usuario de GitHub)*.

## 🚀 Despliegue en la Nube (Railway/Render)

1. Conecta tu cuenta de GitHub a [Railway.app](https://railway.app/).
2. Selecciona el repositorio `adberry-signals`.
3. ¡Listo! Railway detectará todo y te dará una URL pública.
4. Conecta tu dominio en la pestaña **Settings > Domains** de Railway.

## 🤖 Configuración de Señales

- **Telegram**: Crea un bot con @BotFather y obtén el Token. Usa @userinfobot para el Chat ID.
- **TradingView**: Usa la URL del Webhook que aparece en la configuración de la app.
